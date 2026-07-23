// ═══════════════════════════════════════════════════════════════════════════
// Use Case: Move Stage (Kanban Drag & Drop)
// Move uma oportunidade para outra etapa, com todas as automações
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { StageChangedEvent, OpportunityWonEvent, OpportunityLostEvent } from "@/domain/events";
import { OpportunityInvariants } from "@/domain/services/opportunity-invariants";
import { eventBus } from "@/infrastructure/events/event-bus";
import type {
  OpportunityRepository,
  PipelineRepository,
  TimelineRepository,
} from "../ports";

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

export const moveStageSchema = z.object({
  opportunityId: z.number().int().positive(),
  newStageId: z.number().int().positive(),
  lostReason: z.string().min(3).optional().nullable(), // obrigatório se kind=lost
});

export type MoveStageInput = z.infer<typeof moveStageSchema>;

// ─── RESULT ──────────────────────────────────────────────────────────────────

export interface MoveStageResult {
  success: boolean;
  error?: string;
  errorCode?: "VALIDATION" | "NOT_FOUND" | "INVARIANT" | "ALREADY_CLOSED" | "INTERNAL";
  closedAs?: "won" | "lost" | null;
}

// ─── USE CASE ────────────────────────────────────────────────────────────────

export class MoveStageUseCase {
  constructor(
    private opportunityRepo: OpportunityRepository,
    private pipelineRepo: PipelineRepository,
    private timelineRepo: TimelineRepository
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

      const { opportunityId, newStageId, lostReason } = parsed.data;

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

      // 5. Guarda a etapa anterior antes de alterar a entidade
      const previousStageId = opportunity.stageId;

      // 6. Carrega as etapas e valida INV-04
      const newStage = await this.pipelineRepo.getStageById(newStageId);
      if (!newStage) {
        return { success: false, error: "Etapa de destino não encontrada", errorCode: "NOT_FOUND" };
      }

      OpportunityInvariants.assertStageBelongsToPipeline(opportunity.pipelineId, newStage);
      const previousStage = await this.pipelineRepo.getStageById(previousStageId);

      // 7. A entidade altera stageId e status de forma atômica
      if (newStage.kind === "lost") {
        if (!lostReason || lostReason.trim().length < 3) {
          return {
            success: false,
            error: "INV-05: Motivo da perda é obrigatório. Informe por que a oportunidade foi perdida.",
            errorCode: "VALIDATION",
          };
        }
      }
      opportunity.moveToStage(newStageId, newStage.kind, lostReason);

      // 8. Persiste
      await this.opportunityRepo.update(opportunity);

      // 9. Timeline (INV-03: imutável)
      await this.timelineRepo.add({
        personId: opportunity.personId,
        opportunityId: opportunity.id,
        actorId,
        type: "stage_change",
        title: newStage.kind === "won"
          ? "Fechamento (Ganha) 🎉"
          : newStage.kind === "lost"
          ? "Fechamento (Perdida)"
          : "Mudança de etapa",
        description: newStage.kind === "lost"
          ? `Movida para "${newStage.name}". Motivo: ${lostReason}`
          : `Movida para "${newStage.name}"`,
        metadata: {
          fromStage: previousStage?.name ?? String(previousStageId),
          toStage: newStage.name,
          stageKind: newStage.kind,
          lostReason: newStage.kind === "lost" ? lostReason : undefined,
        },
      });

      // 10. Emite eventos (dispara automações)
      await eventBus.emit(
        new StageChangedEvent(
          opportunity.id,
          opportunity.personId,
          previousStageId,
          newStageId,
          newStage.kind,
          "", // productName será resolvido pelo handler se necessário
          actorId
        )
      );

      let closedAs: "won" | "lost" | null = null;

      if (newStage.kind === "won") {
        closedAs = "won";
        await eventBus.emit(
          new OpportunityWonEvent(
            opportunity.id,
            opportunity.personId,
            opportunity.productTypeId,
            opportunity.ownerId,
            opportunity.estimatedValue?.reais ?? null,
            actorId
          )
        );
      } else if (newStage.kind === "lost") {
        closedAs = "lost";
        await eventBus.emit(
          new OpportunityLostEvent(
            opportunity.id,
            opportunity.personId,
            lostReason!,
            actorId
          )
        );
      }

      return { success: true, closedAs };
    } catch (error) {
      if (error instanceof Error && error.name === "InvariantViolationError") {
        return { success: false, error: error.message, errorCode: "INVARIANT" };
      }
      if (error instanceof Error && error.name === "OpportunityValidationError") {
        return { success: false, error: error.message, errorCode: "VALIDATION" };
      }
      console.error("[MoveStageUseCase] Erro inesperado:", error);
      return { success: false, error: "Erro interno ao mover etapa", errorCode: "INTERNAL" };
    }
  }
}
