import { z } from "zod";
import { Activity } from "@/domain/entities/activity.entity";
import { NextStep } from "@/domain/entities/next-step.entity";
import { ActivityRegisteredEvent, NextStepCreatedEvent } from "@/domain/events";
import { eventBus } from "@/infrastructure/events/event-bus";
import { ActivityType } from "@/domain/types";
import type { TransactionManager } from "../ports";

export const registerActivitySchema = z
  .object({
    personId: z.number().int().positive(),
    leadId: z.number().int().positive().optional().nullable(),
    opportunityId: z.number().int().positive().optional().nullable(),
    type: z.nativeEnum(ActivityType),
    description: z.string().max(5000).optional().nullable(),
    generateNextStep: z
      .object({
        enabled: z.boolean().default(false),
        description: z.string().min(3).optional(),
        dueDate: z.string().optional(),
        dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
        objective: z.string().optional().nullable(),
      })
      .optional()
      .default({ enabled: false }),
  })
  .superRefine((data, context) => {
    if (data.leadId && data.opportunityId) {
      context.addIssue({
        code: "custom",
        path: ["leadId"],
        message: "Informe Lead ou Oportunidade, nunca ambos",
      });
    }
    if (
      data.generateNextStep.enabled &&
      (!data.opportunityId ||
        !data.generateNextStep.description ||
        !data.generateNextStep.dueDate)
    ) {
      context.addIssue({
        code: "custom",
        path: ["generateNextStep"],
        message: "Próximo passo exige Oportunidade, descrição e data",
      });
    }
  });

export type RegisterActivityInput = z.infer<typeof registerActivitySchema>;

export interface RegisterActivityResult {
  success: boolean;
  activityId?: number;
  nextStepId?: number;
  error?: string;
  errorCode?: "VALIDATION" | "NOT_FOUND" | "INTERNAL";
}

export class RegisterActivityUseCase {
  constructor(private readonly transaction: TransactionManager) {}

  async execute(
    input: RegisterActivityInput,
    actorId: number | null
  ): Promise<RegisterActivityResult> {
    const parsed = registerActivitySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((issue) => issue.message).join("; "),
        errorCode: "VALIDATION",
      };
    }

    try {
      const data = parsed.data;
      const saved = await this.transaction.run(async (repositories) => {
        if (data.leadId) {
          const lead = await repositories.lead.findById(data.leadId);
          if (!lead) {
            throw new ActivityUseCaseError("NOT_FOUND", "Lead não encontrado");
          }
          if (lead.personId !== data.personId) {
            throw new ActivityUseCaseError(
              "VALIDATION",
              "O Lead não pertence à Pessoa informada"
            );
          }
        }
        if (data.opportunityId) {
          const opportunity = await repositories.opportunity.findById(
            data.opportunityId
          );
          if (!opportunity) {
            throw new ActivityUseCaseError(
              "NOT_FOUND",
              "Oportunidade não encontrada"
            );
          }
          if (opportunity.personId !== data.personId || !opportunity.isOpen) {
            throw new ActivityUseCaseError(
              "VALIDATION",
              "A Oportunidade precisa pertencer à Pessoa e estar aberta"
            );
          }
        }

        const activity = await repositories.activity.create(
          Activity.create({
            personId: data.personId,
            leadId: data.leadId,
            opportunityId: data.opportunityId,
            ownerId: actorId,
            type: data.type,
            description: data.description,
          })
        );
        await repositories.timeline.add({
          personId: data.personId,
          leadId: data.leadId,
          opportunityId: data.opportunityId,
          actorId,
          type: "activity_registered",
          title: "Atividade registrada",
          description: data.description,
        });

        let nextStep = null;
        if (data.generateNextStep.enabled && data.opportunityId) {
          nextStep = await repositories.nextStep.create(
            NextStep.create({
              opportunityId: data.opportunityId,
              ownerId: actorId,
              description: data.generateNextStep.description!,
              dueDate: data.generateNextStep.dueDate!,
              dueTime: data.generateNextStep.dueTime,
              objective: data.generateNextStep.objective,
            })
          );
          await repositories.timeline.add({
            personId: data.personId,
            opportunityId: data.opportunityId,
            actorId,
            type: "next_step_created",
            title: "Próximo passo definido",
            description: nextStep.description,
            metadata: { generatedFromActivity: activity.id },
          });
        }
        return { activity, nextStep };
      });

      if (saved.nextStep && data.opportunityId) {
        await eventBus.emit(
          new NextStepCreatedEvent(
            saved.nextStep.id,
            data.opportunityId,
            data.personId,
            saved.nextStep.dueDate,
            saved.nextStep.description,
            actorId
          )
        );
      }
      await eventBus.emit(
        new ActivityRegisteredEvent(
          saved.activity.id,
          data.personId,
          data.opportunityId ?? null,
          data.type,
          data.description ?? null,
          actorId
        )
      );
      return {
        success: true,
        activityId: saved.activity.id,
        nextStepId: saved.nextStep?.id,
      };
    } catch (error) {
      if (error instanceof ActivityUseCaseError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
        };
      }
      if (
        error instanceof Error &&
        ["ActivityValidationError", "NextStepValidationError"].includes(
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
        error: "Erro interno ao registrar atividade",
        errorCode: "INTERNAL",
      };
    }
  }
}

class ActivityUseCaseError extends Error {
  constructor(
    readonly code: "VALIDATION" | "NOT_FOUND",
    message: string
  ) {
    super(message);
  }
}
