// ═══════════════════════════════════════════════════════════════════════════
// Domain Service: Opportunity Invariants
// Centraliza a validação de regras que envolvem múltiplas entidades
// ═══════════════════════════════════════════════════════════════════════════

import {
  OpportunityCloseOutcome,
  OpportunityStatus,
  type OpportunityCloseOutcome as OpportunityCloseOutcomeType,
  type OpportunityLossReason,
} from "../types";

/** Dados mínimos de uma etapa do pipeline */
export interface StageRef {
  id: number;
  pipelineId: number;
  kind: "open" | "won" | "lost";
}

/** Dados mínimos de um next step */
export interface NextStepRef {
  id: number;
  opportunityId: number;
  status: string;
}

export class OpportunityInvariants {
  /**
   * INV-02: Toda oportunidade aberta DEVE ter pelo menos um NextStep pendente.
   * Chamado antes de persistir uma oportunidade aberta.
   */
  static assertHasPendingNextStep(
    opportunityStatus: OpportunityStatus,
    pendingNextSteps: NextStepRef[]
  ): void {
    if (opportunityStatus !== OpportunityStatus.ABERTA) {
      return; // só vale para oportunidades abertas
    }

    const hasPending = pendingNextSteps.some((ns) => ns.status === "pendente");

    if (!hasPending) {
      throw new InvariantViolationError(
        "INV-02: Toda oportunidade aberta deve possuir um Próximo Passo pendente. " +
        "Crie um próximo passo antes de salvar a oportunidade."
      );
    }
  }

  /**
   * INV-04: A etapa deve pertencer ao mesmo pipeline da oportunidade.
   */
  static assertStageBelongsToPipeline(
    opportunityPipelineId: number,
    stage: StageRef
  ): void {
    if (stage.pipelineId !== opportunityPipelineId) {
      throw new InvariantViolationError(
        `INV-04: Etapa "${stage.id}" pertence ao pipeline ${stage.pipelineId}, ` +
        `mas a oportunidade está no pipeline ${opportunityPipelineId}.`
      );
    }
  }

  /** INV-05: encerramento exige classificação e contexto. */
  static assertCloseDetailsProvided(
    newStatus: OpportunityStatus,
    closeOutcome: OpportunityCloseOutcomeType | null,
    lossReason: OpportunityLossReason | null,
    closeNotes: string | null
  ): void {
    if (newStatus === OpportunityStatus.PERDIDA) {
      if (!closeOutcome || !lossReason || !closeNotes?.trim()) {
        throw new InvariantViolationError(
          "INV-05: Desfecho, motivo e observação são obrigatórios ao encerrar uma oportunidade."
        );
      }
    } else if (
      newStatus === OpportunityStatus.CANCELADA &&
      (
        closeOutcome !==
          OpportunityCloseOutcome.CANCELAMENTO_ERRO_DUPLICIDADE ||
        !closeNotes?.trim()
      )
    ) {
      throw new InvariantViolationError(
        "INV-05: Cancelamento administrativo exige desfecho e observação."
      );
    }
  }

  /**
   * Valida se a transição de status é permitida.
   * Transições válidas:
   *   aberta → ganha
   *   aberta → perdida
   *   aberta → cancelada
   * Oportunidade encerrada nunca é reaberta; o retorno cria uma nova.
   */
  static assertValidStatusTransition(
    currentStatus: OpportunityStatus,
    newStatus: OpportunityStatus
  ): void {
    const validTransitions: Record<OpportunityStatus, OpportunityStatus[]> = {
      [OpportunityStatus.ABERTA]: [
        OpportunityStatus.GANHA,
        OpportunityStatus.PERDIDA,
        OpportunityStatus.CANCELADA,
      ],
      [OpportunityStatus.PERDIDA]: [],
      [OpportunityStatus.GANHA]: [],
      [OpportunityStatus.CANCELADA]: [],
    };

    if (currentStatus === newStatus) return; // no-op

    const allowed = validTransitions[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new InvariantViolationError(
        `Transição de status inválida: "${currentStatus}" → "${newStatus}". ` +
        `Transições permitidas a partir de "${currentStatus}": ${allowed.join(", ") || "nenhuma"}.`
      );
    }
  }

  /**
   * Verifica se uma oportunidade está "parada" (sem movimentação há X dias).
   * Usado pelo dashboard para destacar oportunidades negligenciadas.
   */
  static isStale(lastMovementAt: Date, thresholdDays: number = 7): boolean {
    const now = new Date();
    const diffMs = now.getTime() - lastMovementAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > thresholdDays;
  }

  /**
   * Calcula o "peso" de uma oportunidade para forecast.
   * peso = valor_estimado × probabilidade / 100
   */
  static forecastWeight(
    estimatedValue: number | null,
    probability: number
  ): number {
    if (!estimatedValue) return 0;
    return (estimatedValue * probability) / 100;
  }
}

// ─── ERROR ───────────────────────────────────────────────────────────────────

export class InvariantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantViolationError";
  }
}
