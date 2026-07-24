import { NextStep } from "@/domain/entities/next-step.entity";
import { Opportunity } from "@/domain/entities/opportunity.entity";
import {
  ContactSource,
  EntryChannel,
  OpportunityType,
} from "@/domain/types";
import {
  RENEWAL_WINDOW_DAYS,
  RenewalDetector,
} from "@/domain/services/renewal-detector";
import type {
  OpportunityRepository,
  PersonProductRepository,
  PersonRepository,
  PipelineRepository,
  TransactionManager,
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
    private readonly personProductRepo: PersonProductRepository,
    private readonly opportunityRepo: OpportunityRepository,
    private readonly personRepo: PersonRepository,
    private readonly pipelineRepo: PipelineRepository,
    private readonly transaction: TransactionManager
  ) {}

  async execute(): Promise<RenewalCheckerResult> {
    const errors: string[] = [];
    let opportunitiesCreated = 0;

    try {
      const [products, existing, defaultPipeline] = await Promise.all([
        this.personProductRepo.findRenewable(RENEWAL_WINDOW_DAYS),
        this.opportunityRepo.listRenewals(),
        this.pipelineRepo.getDefaultPipeline(),
      ]);
      const existingRenewals = existing
        .filter((opportunity) => opportunity.renewalKey)
        .map((opportunity) => ({ renewalKey: opportunity.renewalKey! }));

      const enriched = await Promise.all(
        products.map(async (product) => {
          const person = await this.personRepo.findById(product.personId);
          return {
            personProductId: product.id,
            personId: product.personId,
            personName: person?.name ?? `Pessoa ${product.personId}`,
            productTypeId: product.productTypeId,
            productTypeName: `Produto ${product.productTypeId}`,
            renewalDate: product.renewalDate!,
            status: product.status,
            ownerId: person?.relationshipOwnerId ?? null,
          };
        })
      );
      const candidates = this.detector.detect(enriched, existingRenewals);

      if (!defaultPipeline && candidates.length > 0) {
        return {
          scannedProducts: products.length,
          candidatesFound: candidates.length,
          opportunitiesCreated: 0,
          errors: ["Pipeline padrão não configurado"],
        };
      }
      const stages = defaultPipeline
        ? await this.pipelineRepo.getStagesByPipeline(defaultPipeline.id)
        : [];
      const initialStage = stages.find((stage) => stage.kind === "open");

      for (const candidate of candidates) {
        if (!candidate.ownerId) {
          errors.push(
            `Pessoa ${candidate.personId} não possui responsável pelo relacionamento`
          );
          continue;
        }
        if (!initialStage || !defaultPipeline) {
          errors.push("Pipeline padrão não possui etapa aberta");
          break;
        }

        try {
          const created = await this.transaction.run(async (repositories) => {
            const duplicate =
              await repositories.opportunity.findByRenewalKey(
                candidate.renewalKey
              );
            if (duplicate) return false;

            const opportunity = Opportunity.create({
              personId: candidate.personId,
              personProductId: candidate.personProductId,
              productTypeId: candidate.productTypeId,
              pipelineId: defaultPipeline.id,
              stageId: initialStage.id,
              ownerId: candidate.ownerId!,
              createdById: null,
              type: OpportunityType.RENOVACAO,
              attribution: {
                source: ContactSource.BASE_CLIENTES,
                channel: EntryChannel.IMPORTACAO,
                campaign: null,
                referredByPersonId: null,
                sourceDetail: "Renovação automática",
              },
              renewalKey: candidate.renewalKey,
              notes: `Ciclo com vencimento em ${candidate.renewalDate.toLocaleDateString("pt-BR")}.`,
            });
            const savedOpportunity =
              await repositories.opportunity.create(opportunity);

            const nextStep = NextStep.create({
              opportunityId: savedOpportunity.id,
              ownerId: candidate.ownerId,
              description: `Contatar ${candidate.personName} sobre a renovação`,
              dueDate: RenewalDetector.nextStepDueDate(candidate.renewalDate),
              objective: "Apresentar e concluir a renovação antes do vencimento",
            });
            await repositories.nextStep.create(nextStep);
            await repositories.timeline.add({
              personId: candidate.personId,
              opportunityId: savedOpportunity.id,
              actorId: null,
              type: "renewal",
              title: "Oportunidade de renovação criada",
              description: `Ciclo ${candidate.renewalKey} criado automaticamente.`,
              metadata: {
                personProductId: candidate.personProductId,
                renewalDate: candidate.renewalDate.toISOString().slice(0, 10),
              },
            });
            return true;
          });
          if (created) opportunitiesCreated++;
        } catch (error) {
          errors.push(
            `Renovação ${candidate.renewalKey}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      return {
        scannedProducts: products.length,
        candidatesFound: candidates.length,
        opportunitiesCreated,
        errors,
      };
    } catch (error) {
      return {
        scannedProducts: 0,
        candidatesFound: 0,
        opportunitiesCreated: 0,
        errors: [
          error instanceof Error ? error.message : "Erro no processo de renovação",
        ],
      };
    }
  }
}
