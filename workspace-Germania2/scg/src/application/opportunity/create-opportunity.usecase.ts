import { z } from "zod";
import { NextStep } from "@/domain/entities/next-step.entity";
import { Opportunity } from "@/domain/entities/opportunity.entity";
import {
  ContactSource,
  EntryChannel,
  OpportunityType,
} from "@/domain/types";
import {
  NextStepCreatedEvent,
  OpportunityCreatedEvent,
} from "@/domain/events";
import { eventBus } from "@/infrastructure/events/event-bus";
import type {
  PersonRepository,
  PipelineRepository,
  TransactionManager,
} from "../ports";

const directOpportunityTypes = [
  OpportunityType.RENOVACAO,
  OpportunityType.CROSS_SELL,
  OpportunityType.DEMANDA_DIRETA,
] as const;

export const createOpportunitySchema = z
  .object({
    personId: z.number().int().positive(),
    personProductId: z.number().int().positive().optional().nullable(),
    crossSellSuggestionId: z.number().int().positive().optional().nullable(),
    productTypeId: z.number().int().positive(),
    pipelineId: z.number().int().positive(),
    stageId: z.number().int().positive(),
    ownerId: z.number().int().positive(),
    type: z.enum(directOpportunityTypes),
    source: z.nativeEnum(ContactSource),
    channel: z.nativeEnum(EntryChannel),
    campaign: z.string().max(255).optional().nullable(),
    referredByPersonId: z.number().int().positive().optional().nullable(),
    sourceDetail: z.string().max(500).optional().nullable(),
    renewalKey: z.string().max(255).optional().nullable(),
    estimatedValue: z.union([z.number(), z.string()]).optional().nullable(),
    probability: z.number().int().min(0).max(100).optional().default(50),
    notes: z.string().max(5000).optional().nullable(),
    nextStep: z.object({
      description: z.string().min(3),
      dueDate: z.string().min(1),
      dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
      objective: z.string().optional().nullable(),
    }),
  })
  .superRefine((data, context) => {
    if (
      data.type === OpportunityType.RENOVACAO &&
      (!data.personProductId || !data.renewalKey)
    ) {
      context.addIssue({
        code: "custom",
        path: ["personProductId"],
        message: "Renovação exige apólice e chave do ciclo",
      });
    }
    if (
      data.type !== OpportunityType.RENOVACAO &&
      (data.personProductId || data.renewalKey)
    ) {
      context.addIssue({
        code: "custom",
        path: ["renewalKey"],
        message: "Chave de renovação só pode ser usada em renovação",
      });
    }
  });

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

export interface CreateOpportunityResult {
  success: boolean;
  opportunityId?: number;
  nextStepId?: number;
  error?: string;
  errorCode?:
    | "VALIDATION"
    | "PERSON_NOT_FOUND"
    | "STAGE_INVALID"
    | "CONFLICT"
    | "INTERNAL";
}

export class CreateOpportunityUseCase {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly personRepo: PersonRepository,
    private readonly pipelineRepo: PipelineRepository
  ) {}

  async execute(
    input: CreateOpportunityInput,
    actorId: number | null
  ): Promise<CreateOpportunityResult> {
    const parsed = createOpportunitySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
        errorCode: "VALIDATION",
      };
    }

    try {
      const data = parsed.data;
      const [person, stage] = await Promise.all([
        this.personRepo.findById(data.personId),
        this.pipelineRepo.getStageById(data.stageId),
      ]);
      if (!person) {
        return {
          success: false,
          error: `Pessoa com ID ${data.personId} não encontrada`,
          errorCode: "PERSON_NOT_FOUND",
        };
      }
      if (!stage || stage.pipelineId !== data.pipelineId || stage.kind !== "open") {
        return {
          success: false,
          error: "A etapa inicial precisa ser aberta e pertencer ao pipeline",
          errorCode: "STAGE_INVALID",
        };
      }

      const saved = await this.transaction.run(async (repositories) => {
        if (data.renewalKey) {
          const existing = await repositories.opportunity.findByRenewalKey(
            data.renewalKey
          );
          if (existing) {
            throw new DirectOpportunityError(
              "CONFLICT",
              "Este ciclo de renovação já possui uma Oportunidade"
            );
          }
        }

        const opportunity = Opportunity.create({
          personId: data.personId,
          personProductId: data.personProductId,
          crossSellSuggestionId: data.crossSellSuggestionId,
          productTypeId: data.productTypeId,
          pipelineId: data.pipelineId,
          stageId: data.stageId,
          ownerId: data.ownerId,
          createdById: actorId,
          type: data.type,
          attribution: {
            source: data.source,
            channel: data.channel,
            campaign: data.campaign ?? null,
            referredByPersonId: data.referredByPersonId ?? null,
            sourceDetail: data.sourceDetail ?? null,
          },
          renewalKey: data.renewalKey,
          estimatedValue: data.estimatedValue,
          probability: data.probability,
          notes: data.notes,
        });
        const savedOpportunity =
          await repositories.opportunity.create(opportunity);

        const nextStep = NextStep.create({
          opportunityId: savedOpportunity.id,
          ownerId: data.ownerId,
          description: data.nextStep.description,
          dueDate: data.nextStep.dueDate,
          dueTime: data.nextStep.dueTime,
          objective: data.nextStep.objective,
        });
        const savedNextStep = await repositories.nextStep.create(nextStep);

        await repositories.timeline.add({
          personId: data.personId,
          opportunityId: savedOpportunity.id,
          actorId,
          type: "opportunity_created",
          title: "Oportunidade criada",
          description: `Oportunidade do tipo ${data.type} criada.`,
          metadata: {
            source: data.source,
            channel: data.channel,
            campaign: data.campaign,
            stage: stage.name,
          },
        });
        await repositories.timeline.add({
          personId: data.personId,
          opportunityId: savedOpportunity.id,
          actorId,
          type: "next_step_created",
          title: "Primeiro próximo passo definido",
          description: savedNextStep.description,
        });

        return { opportunity: savedOpportunity, nextStep: savedNextStep };
      });

      await eventBus.emitAll([
        new OpportunityCreatedEvent(
          saved.opportunity.id,
          data.personId,
          data.productTypeId,
          data.stageId,
          actorId
        ),
        new NextStepCreatedEvent(
          saved.nextStep.id,
          saved.opportunity.id,
          data.personId,
          saved.nextStep.dueDate,
          saved.nextStep.description,
          actorId
        ),
      ]);

      return {
        success: true,
        opportunityId: saved.opportunity.id,
        nextStepId: saved.nextStep.id,
      };
    } catch (error) {
      if (error instanceof DirectOpportunityError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
        };
      }
      if (
        error instanceof Error &&
        ["OpportunityValidationError", "NextStepValidationError"].includes(
          error.name
        )
      ) {
        return {
          success: false,
          error: error.message,
          errorCode: "VALIDATION",
        };
      }
      return {
        success: false,
        error: "Erro interno ao criar oportunidade",
        errorCode: "INTERNAL",
      };
    }
  }
}

class DirectOpportunityError extends Error {
  constructor(
    readonly code: "CONFLICT",
    message: string
  ) {
    super(message);
  }
}
