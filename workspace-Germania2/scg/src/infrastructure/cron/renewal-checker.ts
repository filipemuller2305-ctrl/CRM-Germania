// ═══════════════════════════════════════════════════════════════════════════
// Cron Job: Renewal Checker
// Roda diariamente. Detecta produtos na janela de renovação e cria
// oportunidades automáticas (INV-09).
// ═══════════════════════════════════════════════════════════════════════════

import { RenewalDetector, RENEWAL_WINDOW_DAYS } from "@/domain/services/renewal-detector";
import { Opportunity } from "@/domain/entities/opportunity.entity";
import { NextStep } from "@/domain/entities/next-step.entity";
import { RenewalApproachingEvent, RenewalOpportunityCreatedEvent } from "@/domain/events";
import { eventBus } from "@/infrastructure/events/event-bus";
import type {
  PersonProductRepository,
  OpportunityRepository,
  NextStepRepository,
  PipelineRepository,
  TimelineRepository,
} from "@/application/ports";

export interface RenewalCheckerResult {
  scannedProducts: number;
  candidatesFound: number;
  opportunitiesCreated: number;
  errors: string[];
}

export class RenewalCheckerCron {
  private readonly detector = new RenewalDetector();

  constructor(
    private personProductRepo: PersonProductRepository,
    private opportunityRepo: OpportunityRepository,
    private nextStepRepo: NextStepRepository,
    private pipelineRepo: PipelineRepository,
    private timelineRepo: TimelineRepository
  ) {}

  /**
   * Executa a verificação de renovações.
   * Chamado via cron (ex: Vercel Cron, GitHub Actions, ou /api/cron/renewals).
   */
  async execute(): Promise<RenewalCheckerResult> {
    const errors: string[] = [];
    let opportunitiesCreated = 0;

    try {
      // 1. Busca todos os produtos ativos com renewal_date na janela
      const products = await this.personProductRepo.findRenewable(RENEWAL_WINDOW_DAYS);

      // 2. Busca todas as oportunidades abertas (para evitar duplicatas)
      const openOpps = await this.opportunityRepo.listOpen({ limit: 10000 });
      const openOppRefs = openOpps.data.map((o) => ({
        personId: o.personId,
        productTypeId: o.productTypeId,
      }));

      // 3. Detecta candidatos
      // NOTA: Em produção, o repositório deve retornar dados enriquecidos.
      // Aqui simulamos a interface esperada pelo detector.
      const renewableProducts = products.map((p) => ({
        personProductId: p.id,
        personId: p.personId,
        personName: "", // será resolvido pelo repositório em produção
        productTypeId: p.productTypeId,
        productTypeName: "", // será resolvido pelo repositório em produção
        renewalDate: p.renewalDate!,
        status: p.status,
        ownerId: null, // será resolvido pelo repositório
      }));

      const candidates = this.detector.detect(renewableProducts, openOppRefs);

      // 4. Para cada candidato, cria oportunidade de renovação
      const defaultPipeline = await this.pipelineRepo.getDefaultPipeline();
      if (!defaultPipeline && candidates.length > 0) {
        errors.push("Pipeline padrão não configurado. Não é possível criar oportunidades de renovação.");
        return {
          scannedProducts: products.length,
          candidatesFound: candidates.length,
          opportunitiesCreated: 0,
          errors,
        };
      }

      for (const candidate of candidates) {
        try {
          // Busca a primeira etapa do pipeline padrão
          const stages = await this.pipelineRepo.getStagesByPipeline(defaultPipeline!.id);
          const firstStage = stages.find((s) => s.kind === "open");
          if (!firstStage) {
            errors.push(`Pipeline ${defaultPipeline!.id} não tem etapa inicial do tipo "open"`);
            continue;
          }

          // Cria oportunidade de renovação
          const opportunity = Opportunity.create({
            personId: candidate.personId,
            productTypeId: candidate.productTypeId,
            pipelineId: defaultPipeline!.id,
            stageId: firstStage.id,
            ownerId: candidate.ownerId,
            origin: "Renovação Automática",
            notes: `Renovação automática detectada. Vencimento em ${candidate.daysUntilRenewal} dias (${candidate.renewalDate.toLocaleDateString("pt-BR")}).`,
          });

          const savedOpp = await this.opportunityRepo.create(opportunity);

          // Cria next step (INV-02)
          const nextStepDue = RenewalDetector.nextStepDueDate(candidate.renewalDate);
          const nextStep = NextStep.create({
            opportunityId: savedOpp.id,
            ownerId: candidate.ownerId,
            description: `Entrar em contato com ${candidate.personName} sobre renovação do seguro`,
            dueDate: nextStepDue,
            objective: `Garantir renovação antes do vencimento em ${candidate.renewalDate.toLocaleDateString("pt-BR")}`,
          });

          await this.nextStepRepo.create(nextStep);

          // Timeline
          await this.timelineRepo.add({
            personId: candidate.personId,
            opportunityId: savedOpp.id,
            actorId: null, // sistema
            type: "renewal",
            title: "Oportunidade de renovação criada automaticamente",
            description: `Seguro vence em ${candidate.daysUntilRenewal} dias. Oportunidade criada pelo sistema.`,
            metadata: {
              renewalDate: candidate.renewalDate.toISOString().split("T")[0],
              daysUntilRenewal: candidate.daysUntilRenewal,
              personProductId: candidate.personProductId,
            },
          });

          // Eventos
          await eventBus.emit(
            new RenewalApproachingEvent(
              candidate.personProductId,
              candidate.personId,
              candidate.personName,
              candidate.productTypeId,
              candidate.renewalDate,
              candidate.daysUntilRenewal
            )
          );

          await eventBus.emit(
            new RenewalOpportunityCreatedEvent(
              savedOpp.id,
              candidate.personId,
              candidate.productTypeId,
              candidate.renewalDate
            )
          );

          opportunitiesCreated++;
        } catch (err) {
          const msg = `Erro ao criar renovação para pessoa ${candidate.personId}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(msg);
          console.error(`[RenewalChecker] ${msg}`);
        }
      }

      return {
        scannedProducts: products.length,
        candidatesFound: candidates.length,
        opportunitiesCreated,
        errors,
      };
    } catch (error) {
      const msg = `Erro fatal no RenewalChecker: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[RenewalChecker] ${msg}`);
      return {
        scannedProducts: 0,
        candidatesFound: 0,
        opportunitiesCreated: 0,
        errors: [msg],
      };
    }
  }
}
