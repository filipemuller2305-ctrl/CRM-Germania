// ═══════════════════════════════════════════════════════════════════════════
// Use Case: Complete Next Step
// Conclui um próximo passo. Se a oportunidade continuar aberta,
// exige a criação de um novo próximo passo (INV-02).
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { NextStepCompletedEvent } from "@/domain/events";
import { eventBus } from "@/infrastructure/events/event-bus";
import type {
  NextStepRepository,
  OpportunityRepository,
  TimelineRepository,
} from "../ports";

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

export const completeNextStepSchema = z.object({
  nextStepId: z.number().int().positive(),
  // Se true, exige que um novo next step seja criado junto
  createNewNextStep: z.object({
    enabled: z.boolean().default(true),
    description: z.string().min(3).optional(),
    dueDate: z.string().optional(),
    dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    objective: z.string().optional().nullable(),
  }).optional().default({ enabled: true }),
});

export type CompleteNextStepInput = z.infer<typeof completeNextStepSchema>;

// ─── RESULT ──────────────────────────────────────────────────────────────────

export interface CompleteNextStepResult {
  success: boolean;
  newNextStepId?: number;
  error?: string;
  errorCode?: "VALIDATION" | "NOT_FOUND" | "REQUIRES_NEW_STEP" | "INTERNAL";
}

// ─── USE CASE ────────────────────────────────────────────────────────────────

export class CompleteNextStepUseCase {
  constructor(
    private nextStepRepo: NextStepRepository,
    private opportunityRepo: OpportunityRepository,
    private timelineRepo: TimelineRepository
  ) {}

  async execute(input: CompleteNextStepInput, actorId: number | null): Promise<CompleteNextStepResult> {
    try {
      const parsed = completeNextStepSchema.safeParse(input);
      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error.errors.map((e) => e.message).join("; "),
          errorCode: "VALIDATION",
        };
      }

      const { nextStepId, createNewNextStep } = parsed.data;

      // 1. Carrega next step
      const nextStep = await this.nextStepRepo.findById(nextStepId);
      if (!nextStep) {
        return { success: false, error: "Próximo passo não encontrado", errorCode: "NOT_FOUND" };
      }

      if (!nextStep.isPending) {
        return {
          success: false,
          error: `Próximo passo já está ${nextStep.status}. Apenas pendentes podem ser concluídos.`,
          errorCode: "VALIDATION",
        };
      }

      // 2. Verifica se a oportunidade ainda está aberta
      const opportunity = await this.opportunityRepo.findById(nextStep.opportunityId);
      if (!opportunity) {
        return { success: false, error: "Oportunidade vinculada não encontrada", errorCode: "NOT_FOUND" };
      }

      // 3. Se oportunidade está aberta, INV-02 exige novo next step
      if (opportunity.isOpen && createNewNextStep.enabled) {
        if (!createNewNextStep.description || !createNewNextStep.dueDate) {
          return {
            success: false,
            error: "INV-02: A oportunidade continua aberta. Defina o próximo passo antes de concluir este.",
            errorCode: "REQUIRES_NEW_STEP",
          };
        }
      }

      // 4. Conclui o next step atual
      nextStep.complete();
      await this.nextStepRepo.update(nextStep);

      // 5. Timeline
      await this.timelineRepo.add({
        personId: opportunity.personId,
        opportunityId: opportunity.id,
        actorId,
        type: "next_step_done",
        title: "Próximo passo concluído",
        description: nextStep.description,
      });

      // 6. Cria novo next step se necessário (INV-02)
      let newNextStepId: number | undefined;

      if (opportunity.isOpen && createNewNextStep.enabled && createNewNextStep.description && createNewNextStep.dueDate) {
        const { NextStep } = await import("@/domain/entities/next-step.entity");
        const newStep = NextStep.create({
          opportunityId: opportunity.id,
          ownerId: nextStep.ownerId ?? actorId,
          description: createNewNextStep.description,
          dueDate: createNewNextStep.dueDate,
          dueTime: createNewNextStep.dueTime,
          objective: createNewNextStep.objective,
        });

        const saved = await this.nextStepRepo.create(newStep);
        newNextStepId = saved.id;

        await this.timelineRepo.add({
          personId: opportunity.personId,
          opportunityId: opportunity.id,
          actorId,
          type: "next_step_created",
          title: "Novo próximo passo definido",
          description: saved.description,
          metadata: {
            dueDate: saved.dueDate.toISOString().split("T")[0],
            previousStepId: nextStepId,
          },
        });
      }

      // 7. Emite evento
      await eventBus.emit(
        new NextStepCompletedEvent(
          nextStepId,
          opportunity.id,
          opportunity.personId,
          actorId
        )
      );

      return { success: true, newNextStepId };
    } catch (error) {
      if (error instanceof Error && error.name === "NextStepValidationError") {
        return { success: false, error: error.message, errorCode: "VALIDATION" };
      }
      console.error("[CompleteNextStepUseCase] Erro inesperado:", error);
      return { success: false, error: "Erro interno ao concluir próximo passo", errorCode: "INTERNAL" };
    }
  }
}
