// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: CustomerSuccessStage
// Etapas de relacionamento pós-venda (criadas automaticamente ao fechar ganha)
// ═══════════════════════════════════════════════════════════════════════════

import {
  CustomerSuccessStageType,
  CustomerSuccessStageStatus,
  CS_STAGE_ORDER,
  CS_STAGE_DUE_OFFSETS,
} from "../types";

export interface CustomerSuccessStageProps {
  id: number;
  personId: number;
  opportunityId: number;
  ownerId: number | null;
  stage: CustomerSuccessStageType;
  status: CustomerSuccessStageStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  notes: string | null;
  createdAt: Date;
}

export class CustomerSuccessStage {
  private constructor(private props: CustomerSuccessStageProps) {}

  // ─── FACTORY ─────────────────────────────────────────────────────────────

  /**
   * Cria TODAS as etapas de CS para uma oportunidade ganha.
   * Chamado automaticamente quando uma oportunidade é fechada como ganha.
   */
  static createAllForOpportunity(
    personId: number,
    opportunityId: number,
    ownerId: number | null,
    closedAt: Date
  ): CustomerSuccessStage[] {
    return CS_STAGE_ORDER.map((stageType) => {
      const offsetDays = CS_STAGE_DUE_OFFSETS[stageType];
      const dueDate = new Date(closedAt);
      dueDate.setDate(dueDate.getDate() + offsetDays);

      return new CustomerSuccessStage({
        id: 0,
        personId,
        opportunityId,
        ownerId,
        stage: stageType,
        status: CustomerSuccessStageStatus.PENDENTE,
        dueDate,
        completedAt: null,
        notes: null,
        createdAt: new Date(),
      });
    });
  }

  static reconstitute(props: CustomerSuccessStageProps): CustomerSuccessStage {
    return new CustomerSuccessStage(props);
  }

  // ─── BEHAVIOR ────────────────────────────────────────────────────────────

  complete(notes?: string): void {
    if (this.props.status !== CustomerSuccessStageStatus.PENDENTE) {
      throw new CustomerSuccessValidationError(
        `Apenas etapas pendentes podem ser concluídas. Status: ${this.props.status}`
      );
    }
    this.props.status = CustomerSuccessStageStatus.CONCLUIDO;
    this.props.completedAt = new Date();
    if (notes) this.props.notes = notes.trim();
  }

  cancel(notes?: string): void {
    if (this.props.status !== CustomerSuccessStageStatus.PENDENTE) {
      throw new CustomerSuccessValidationError("Apenas etapas pendentes podem ser canceladas");
    }
    this.props.status = CustomerSuccessStageStatus.CANCELADO;
    if (notes) this.props.notes = notes.trim();
  }

  addNotes(notes: string): void {
    this.props.notes = notes.trim();
  }

  // ─── GETTERS ─────────────────────────────────────────────────────────────

  get id(): number { return this.props.id; }
  get personId(): number { return this.props.personId; }
  get opportunityId(): number { return this.props.opportunityId; }
  get ownerId(): number | null { return this.props.ownerId; }
  get stage(): CustomerSuccessStageType { return this.props.stage; }
  get status(): CustomerSuccessStageStatus { return this.props.status; }
  get dueDate(): Date | null { return this.props.dueDate; }
  get completedAt(): Date | null { return this.props.completedAt; }
  get notes(): string | null { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }

  get isPending(): boolean { return this.props.status === CustomerSuccessStageStatus.PENDENTE; }
  get isCompleted(): boolean { return this.props.status === CustomerSuccessStageStatus.CONCLUIDO; }

  get isOverdue(): boolean {
    if (!this.isPending || !this.props.dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.props.dueDate < today;
  }

  /** Índice de ordem da etapa (0-5) */
  get orderIndex(): number {
    return CS_STAGE_ORDER.indexOf(this.props.stage);
  }

  // ─── PERSISTENCE ─────────────────────────────────────────────────────────

  toPersistence() {
    return {
      id: this.props.id || undefined,
      personId: this.props.personId,
      opportunityId: this.props.opportunityId,
      ownerId: this.props.ownerId,
      stage: this.props.stage,
      status: this.props.status,
      dueDate: this.props.dueDate?.toISOString().split("T")[0] ?? null,
      completedAt: this.props.completedAt,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
    };
  }
}

export class CustomerSuccessValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerSuccessValidationError";
  }
}
