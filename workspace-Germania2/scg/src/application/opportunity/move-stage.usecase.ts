// ═══════════════════════════════════════════════════════════════════════════
// Use Case: Move Stage (Kanban Drag & Drop)
// Move uma oportunidade para outra etapa, com todas as automações
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { StageChangedEvent, OpportunityWonEvent, OpportunityLostEvent } from "@/domain/events";
import { ScheduledCommercialReturn } from "@/domain/entities/scheduled-commercial-return.entity";
import { OpportunityInvariants } from "@/domain/services/opportunity-invariants";
import {
  OpportunityCloseOutcome,
  OpportunityLossReason,
} from "@/domain/types";
import { eventBus } from "@/infrastructure/events/event-bus";
import type {
  OpportunityRepository,
  PipelineRepository,
  TransactionManager,
} from "../ports";

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

export const moveStageSchema = z.object({
  opportunityId: z.number().int().positive(),
  newStageId: z.number().int().positive(),
  closeOutcome: z
    .enum(Object.values(OpportunityCloseOutcome) as [string, ...string[]])
    .optional()
    .nullable(),
  lossReason: z
    .enum(Object.values(OpportunityLossReason) as [string, ...string[]])
    .optional()
    .nullable(),
  closeNotes: z.string().min(3).optional().nullable(),
  nextExpirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export type MoveStageInput = z.infer<typeof moveStageSchema>;

// ─── RESULT ──────────────────────────────────────────────────────────────────

export interface MoveStageResult {
  success: boolean;
  error?: string;
  errorCode?: "VALIDATION" | "NOT_FOUND" | "INVARIANT" | "ALREADY_CLOSED" | "INTERNAL";
  closedAs?: "won" | "lost" | "cancelled" | null;
}

// ─── USE CASE ────────────────────────────────────────────────────────────────

export class MoveStageUseCase {
  constructor(
    private opportunityRepo: OpportunityRepository,
    private pipelineRepo: PipelineRepository,
    private transaction: TransactionManager
  ) {}

  async execute(input: MoveStageInput, actorId: number | null): Promise<MoveStageResult> {
    try {
      // 1. Validação
      const parsed = moveStageSchema.safeParse(input);
      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error.issues.map((e) => e.message).join("; "),
          errorCode: "VALIDATION",
        };
      }

      const {
        opportunityId,
        newStageId,
        closeOutcome,
        lossReason,
        closeNotes,
        nextExpirationDate,
      } = parsed.data;

      // 2. Carrega oportunidade
      const opportunity = await this.opportunityRepo.findById(opportunityId);
      if (!opportunity) {
        return { success: false, error: "Oportunidade não encontrada", errorCode: "NOT_FOUND" };
      }

      // 3. Verifica se está aberta
      if (!opportunity.isOpen) {
        return {
          success: false,
          error: "Apenas oportunidades abertas podem ser movidas no Kanban",
          errorCode: "ALREADY_CLOSED",
        };
      }

      // 4. Se já está na mesma etapa, no-op
      if (opportunity.stageId === newStageId) {
        return { success: true, closedAs: null };
      }

      // 5. Carrega a etapa de destino antes de iniciar a transação
      const newStage = await this.pipelineRepo.getStageById(newStageId);
      if (!newStage) {
        return { success: false, error: "Etapa de destino não encontrada", errorCode: "NOT_FOUND" };
      }

      if (newStage.kind === "lost") {
        if (!closeOutcome || !closeNotes) {
          return {
            success: false,
            error:
              "Desfecho, motivo e observação são obrigatórios ao encerrar a oportunidade.",
            errorCode: "VALIDATION",
          };
        }
      }
      OpportunityInvariants.assertStageBelongsToPipeline(
        opportunity.pipelineId,
        newStage
      );
      const previousStage = await this.pipelineRepo.getStageById(
        opportunity.stageId
      );

      const committed = await this.transaction.run(async (repositories) => {
        const current = await repositories.opportunity.findById(opportunityId);
        if (!current) {
          throw new Error("Oportunidade não encontrada durante a transação");
        }
        if (!current.isOpen) {
          throw new Error("ALREADY_CLOSED");
        }
        OpportunityInvariants.assertStageBelongsToPipeline(
          current.pipelineId,
          newStage
        );

        const previousStageId = current.stageId;
        current.moveToStage(
          newStageId,
          newStage.kind,
          newStage.kind === "lost"
            ? {
                outcome: closeOutcome as any,
                reason: lossReason as any,
                notes: closeNotes!,
                nextExpirationDate,
              }
            : null
        );
        await repositories.opportunity.update(current);

        let scheduledReturnId: number | null = null;
        if (
          newStage.kind === "lost" &&
          current.nextExpirationDate &&
          current.status === "perdida"
        ) {
          const existing =
            await repositories.scheduledCommercialReturn.findBySourceOpportunityId(
              current.id
            );
          if (!existing) {
            const scheduled = ScheduledCommercialReturn.schedule({
              personId: current.personId,
              sourceOpportunityId: current.id,
              productTypeId: current.productTypeId,
              ownerId: current.ownerId,
              closeOutcome: current.closeOutcome!,
              nextExpirationDate: current.nextExpirationDate,
              notes: current.closeNotes!,
            });
            const saved =
              await repositories.scheduledCommercialReturn.create(scheduled);
            scheduledReturnId = saved.id;
            await repositories.timeline.add({
              personId: current.personId,
              opportunityId: current.id,
              actorId,
              type: "commercial_return_scheduled",
              title: "Retorno comercial programado",
              description: `Nova abordagem em ${saved.scheduledFor.toLocaleDateString(
                "pt-BR"
              )}, 45 dias antes do próximo vencimento.`,
              metadata: {
                scheduledReturnId: saved.id,
                nextExpirationDate: saved.nextExpirationDate
                  .toISOString()
                  .slice(0, 10),
                scheduledFor: saved.scheduledFor.toISOString().slice(0, 10),
              },
            });
          }
        }

        const cancelled = current.isCancelled;
        await repositories.timeline.add({
          personId: current.personId,
          opportunityId: current.id,
          actorId,
          type:
            newStage.kind === "won"
              ? "closed_won"
              : cancelled
                ? "closed_cancelled"
                : newStage.kind === "lost"
                  ? "closed_lost"
                  : "stage_change",
          title:
            newStage.kind === "won"
              ? "Oportunidade ganha"
              : cancelled
                ? "Oportunidade cancelada"
                : newStage.kind === "lost"
                  ? "Oportunidade encerrada sem sucesso"
                  : "Mudança de etapa",
          description:
            newStage.kind === "lost"
              ? `${closeNotes} (desfecho: ${closeOutcome}; motivo: ${
                  lossReason ?? "não se aplica"
                })`
              : `Movida para "${newStage.name}"`,
          metadata: {
            fromStage: previousStage?.name ?? String(previousStageId),
            toStage: newStage.name,
            stageKind: newStage.kind,
            closeOutcome,
            lossReason,
            nextExpirationDate,
            scheduledReturnId,
          },
        });

        return {
          opportunity: current,
          previousStageId,
          closedAs: current.isWon
            ? ("won" as const)
            : current.isCancelled
              ? ("cancelled" as const)
              : current.isLost
                ? ("lost" as const)
                : null,
        };
      });

      // Eventos são publicados somente depois do commit.
      await eventBus.emit(
        new StageChangedEvent(
          committed.opportunity.id,
          committed.opportunity.personId,
          committed.previousStageId,
          newStageId,
          newStage.kind,
          "", // productName será resolvido pelo handler se necessário
          actorId
        )
      );

      if (committed.closedAs === "won") {
        await eventBus.emit(
          new OpportunityWonEvent(
            committed.opportunity.id,
            committed.opportunity.personId,
            committed.opportunity.productTypeId,
            committed.opportunity.ownerId,
            committed.opportunity.estimatedValue?.reais ?? null,
            actorId
          )
        );
      } else if (committed.closedAs === "lost") {
        await eventBus.emit(
          new OpportunityLostEvent(
            committed.opportunity.id,
            committed.opportunity.personId,
            committed.opportunity.closeOutcome!,
            committed.opportunity.lossReason!,
            actorId
          )
        );
      }

      return { success: true, closedAs: committed.closedAs };
    } catch (error) {
      if (error instanceof Error && error.name === "InvariantViolationError") {
        return { success: false, error: error.message, errorCode: "INVARIANT" };
      }
      if (error instanceof Error && error.name === "OpportunityValidationError") {
        return { success: false, error: error.message, errorCode: "VALIDATION" };
      }
      if (error instanceof Error && error.name === "ScheduledCommercialReturnValidationError") {
        return { success: false, error: error.message, errorCode: "VALIDATION" };
      }
      if (error instanceof Error && error.message === "ALREADY_CLOSED") {
        return {
          success: false,
          error: "A oportunidade já foi encerrada",
          errorCode: "ALREADY_CLOSED",
        };
      }
      console.error("[MoveStageUseCase] Erro inesperado:", error);
      return { success: false, error: "Erro interno ao mover etapa", errorCode: "INTERNAL" };
    }
  }
}
