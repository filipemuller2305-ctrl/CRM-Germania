import { NextStep } from "@/domain/entities/next-step.entity";
import { Opportunity } from "@/domain/entities/opportunity.entity";
import {
  ContactSource,
  EntryChannel,
  OpportunityType,
} from "@/domain/types";
import type {
  PersonRepository,
  PipelineRepository,
  ScheduledCommercialReturnRepository,
  TransactionManager,
} from "@/application/ports";

export interface CommercialReturnCheckerResult {
  dueReturns: number;
  opportunitiesCreated: number;
  errors: string[];
}

export class CommercialReturnCheckerCron {
  constructor(
    private readonly commercialReturnRepo: ScheduledCommercialReturnRepository,
    private readonly personRepo: PersonRepository,
    private readonly pipelineRepo: PipelineRepository,
    private readonly transaction: TransactionManager
  ) {}

  async execute(
    referenceDate: Date = new Date()
  ): Promise<CommercialReturnCheckerResult> {
    const errors: string[] = [];
    let opportunitiesCreated = 0;

    const [dueReturns, defaultPipeline] = await Promise.all([
      this.commercialReturnRepo.findDue(referenceDate),
      this.pipelineRepo.getDefaultPipeline(),
    ]);
    if (!defaultPipeline && dueReturns.length > 0) {
      return {
        dueReturns: dueReturns.length,
        opportunitiesCreated: 0,
        errors: ["Pipeline padrão não configurado"],
      };
    }

    const stages = defaultPipeline
      ? await this.pipelineRepo.getStagesByPipeline(defaultPipeline.id)
      : [];
    const initialStage = stages
      .filter((stage) => stage.kind === "open")
      .sort((a, b) => a.order - b.order)[0];
    if ((!defaultPipeline || !initialStage) && dueReturns.length > 0) {
      return {
        dueReturns: dueReturns.length,
        opportunitiesCreated: 0,
        errors: ["Pipeline padrão não possui etapa inicial aberta"],
      };
    }

    for (const dueReturn of dueReturns) {
      try {
        const person = await this.personRepo.findById(dueReturn.personId);
        const created = await this.transaction.run(async (repositories) => {
          const current =
            await repositories.scheduledCommercialReturn.findById(
              dueReturn.id
            );
          if (!current || current.status !== "pendente") return false;

          const duplicate = await repositories.opportunity.findByRecoveryKey(
            current.recoveryKey
          );
          if (duplicate) {
            current.markProcessed(duplicate.id);
            await repositories.scheduledCommercialReturn.update(current);
            return false;
          }

          const opportunity = Opportunity.create({
            personId: current.personId,
            productTypeId: current.productTypeId,
            pipelineId: defaultPipeline!.id,
            stageId: initialStage!.id,
            ownerId: current.ownerId,
            createdById: null,
            type: OpportunityType.RECUPERACAO,
            attribution: {
              source: ContactSource.BASE_CLIENTES,
              channel: EntryChannel.IMPORTACAO,
              campaign: null,
              referredByPersonId: null,
              sourceDetail: "Retorno de renovação não fechada",
            },
            recoveryKey: current.recoveryKey,
            notes: `Retorno programado da oportunidade ${current.sourceOpportunityId}. Próximo vencimento em ${current.nextExpirationDate.toLocaleDateString(
              "pt-BR"
            )}. ${current.notes}`,
          });
          const savedOpportunity =
            await repositories.opportunity.create(opportunity);

          const nextStep = NextStep.create({
            opportunityId: savedOpportunity.id,
            ownerId: current.ownerId,
            description: `Retomar contato com ${
              person?.name ?? `Pessoa ${current.personId}`
            }`,
            dueDate: referenceDate,
            objective:
              "Iniciar a recuperação 45 dias antes do vencimento externo",
          });
          await repositories.nextStep.create(nextStep);

          current.markProcessed(savedOpportunity.id);
          await repositories.scheduledCommercialReturn.update(current);
          await repositories.timeline.add({
            personId: current.personId,
            opportunityId: savedOpportunity.id,
            actorId: null,
            type: "commercial_return_activated",
            title: "Oportunidade de recuperação criada",
            description: `Retorno comercial ${current.id} ativado automaticamente.`,
            metadata: {
              scheduledReturnId: current.id,
              sourceOpportunityId: current.sourceOpportunityId,
              nextExpirationDate: current.nextExpirationDate
                .toISOString()
                .slice(0, 10),
            },
          });
          return true;
        });
        if (created) opportunitiesCreated++;
      } catch (error) {
        errors.push(
          `Retorno ${dueReturn.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return {
      dueReturns: dueReturns.length,
      opportunitiesCreated,
      errors,
    };
  }
}
