// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: Opportunity
// Representa um processo comercial vinculado a uma Pessoa e um Produto
// ═══════════════════════════════════════════════════════════════════════════

import { OpportunityStatus, type Origin } from "../types";
import { Money } from "../value-objects/money";

export interface OpportunityProps {
  id: number;
  personId: number;
  productTypeId: number;
  pipelineId: number;
  stageId: number;
  ownerId: number | null;
  estimatedValue: Money | null;
  probability: number;
  origin: Origin | null;
  status: OpportunityStatus;
  lostReason: string | null;
  notes: string | null;
  createdAt: Date;
  lastMovementAt: Date;
  closedAt: Date | null;
}

export interface CreateOpportunityInput {
  personId: number;
  productTypeId: number;
  pipelineId: number;
  stageId: number;
  ownerId?: number | null;
  estimatedValue?: number | string | null;
  probability?: number;
  origin?: Origin | null;
  notes?: string | null;
}

export class Opportunity {
  private constructor(private props: OpportunityProps) {}

  // ─── FACTORY ─────────────────────────────────────────────────────────────

  static create(input: CreateOpportunityInput): Opportunity {
    // Validações
    if (!input.personId || input.personId <= 0) {
      throw new OpportunityValidationError("Oportunidade deve estar vinculada a uma Pessoa");
    }
    if (!input.productTypeId || input.productTypeId <= 0) {
      throw new OpportunityValidationError("Oportunidade deve ter um Produto definido");
    }
    if (!input.pipelineId || input.pipelineId <= 0) {
      throw new OpportunityValidationError("Oportunidade deve pertencer a um Pipeline");
    }
    if (!input.stageId || input.stageId <= 0) {
      throw new OpportunityValidationError("Oportunidade deve ter uma Etapa inicial");
    }

    const probability = input.probability ?? 50;
    if (probability < 0 || probability > 100) {
      throw new OpportunityValidationError("Probabilidade deve estar entre 0 e 100");
    }

    return new Opportunity({
      id: 0,
      personId: input.personId,
      productTypeId: input.productTypeId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      ownerId: input.ownerId ?? null,
      estimatedValue: Money.optional(input.estimatedValue),
      probability,
      origin: input.origin ?? null,
      status: OpportunityStatus.ABERTA,
      lostReason: null,
      notes: input.notes?.trim() || null,
      createdAt: new Date(),
      lastMovementAt: new Date(),
      closedAt: null,
    });
  }

  static reconstitute(props: OpportunityProps): Opportunity {
    return new Opportunity(props);
  }

  // ─── BEHAVIOR ────────────────────────────────────────────────────────────

  /**
   * Move para uma nova etapa do pipeline.
   * INV-04: A etapa deve pertencer ao mesmo pipeline.
   */
  moveToStage(newStageId: number, stageKind: "open" | "won" | "lost"): void {
    if (!this.isOpen) {
      throw new OpportunityValidationError(
        "Apenas oportunidades abertas podem mudar de etapa"
      );
    }

    if (newStageId === this.props.stageId) {
      return; // no-op
    }

    this.props.stageId = newStageId;
    this.props.lastMovementAt = new Date();

    // Se a etapa é de fechamento, delega para métodos específicos
    if (stageKind === "won") {
      this.closeAsWon();
    } else if (stageKind === "lost") {
      // lostReason será exigido via closeAsLost
    }
  }

  /** Fecha como GANHA */
  closeAsWon(): void {
    if (!this.isOpen) {
      throw new OpportunityValidationError("Oportunidade já está fechada");
    }

    this.props.status = OpportunityStatus.GANHA;
    this.props.closedAt = new Date();
    this.props.probability = 100;
    this.props.lastMovementAt = new Date();
  }

  /**
   * Fecha como PERDIDA.
   * INV-05: lostReason é obrigatório.
   */
  closeAsLost(reason: string): void {
    if (!this.isOpen) {
      throw new OpportunityValidationError("Oportunidade já está fechada");
    }

    if (!reason || reason.trim().length < 3) {
      throw new OpportunityValidationError(
        "Motivo da perda é obrigatório (mínimo 3 caracteres)"
      );
    }

    this.props.status = OpportunityStatus.PERDIDA;
    this.props.lostReason = reason.trim();
    this.props.closedAt = new Date();
    this.props.probability = 0;
    this.props.lastMovementAt = new Date();
  }

  /** Reabre uma oportunidade perdida (requer novo next step) */
  reopen(): void {
    if (this.isOpen) {
      throw new OpportunityValidationError("Oportunidade já está aberta");
    }

    this.props.status = OpportunityStatus.ABERTA;
    this.props.closedAt = null;
    this.props.lostReason = null;
    this.props.lastMovementAt = new Date();
  }

  /** Atualiza valor estimado */
  updateEstimatedValue(value: number | string | null): void {
    if (!this.isOpen) {
      throw new OpportunityValidationError("Não é possível alterar oportunidade fechada");
    }
    this.props.estimatedValue = Money.optional(value);
  }

  /** Atualiza probabilidade */
  updateProbability(value: number): void {
    if (value < 0 || value > 100) {
      throw new OpportunityValidationError("Probabilidade deve estar entre 0 e 100");
    }
    this.props.probability = value;
  }

  /** Atualiza notas */
  updateNotes(notes: string | null): void {
    this.props.notes = notes?.trim() || null;
  }

  // ─── GETTERS ─────────────────────────────────────────────────────────────

  get id(): number { return this.props.id; }
  get personId(): number { return this.props.personId; }
  get productTypeId(): number { return this.props.productTypeId; }
  get pipelineId(): number { return this.props.pipelineId; }
  get stageId(): number { return this.props.stageId; }
  get ownerId(): number | null { return this.props.ownerId; }
  get estimatedValue(): Money | null { return this.props.estimatedValue; }
  get probability(): number { return this.props.probability; }
  get origin(): Origin | null { return this.props.origin; }
  get status(): OpportunityStatus { return this.props.status; }
  get lostReason(): string | null { return this.props.lostReason; }
  get notes(): string | null { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }
  get lastMovementAt(): Date { return this.props.lastMovementAt; }
  get closedAt(): Date | null { return this.props.closedAt; }

  get isOpen(): boolean { return this.props.status === OpportunityStatus.ABERTA; }
  get isWon(): boolean { return this.props.status === OpportunityStatus.GANHA; }
  get isLost(): boolean { return this.props.status === OpportunityStatus.PERDIDA; }

  /** Dias sem movimentação */
  get daysStale(): number {
    const now = new Date();
    return Math.floor(
      (now.getTime() - this.props.lastMovementAt.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // ─── PERSISTENCE ─────────────────────────────────────────────────────────

  toPersistence() {
    return {
      id: this.props.id || undefined,
      personId: this.props.personId,
      productTypeId: this.props.productTypeId,
      pipelineId: this.props.pipelineId,
      stageId: this.props.stageId,
      ownerId: this.props.ownerId,
      estimatedValue: this.props.estimatedValue?.reais ?? null,
      probability: this.props.probability,
      origin: this.props.origin,
      status: this.props.status,
      lostReason: this.props.lostReason,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      lastMovementAt: this.props.lastMovementAt,
      closedAt: this.props.closedAt,
    };
  }
}

// ─── ERROR ───────────────────────────────────────────────────────────────────

export class OpportunityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpportunityValidationError";
  }
}
