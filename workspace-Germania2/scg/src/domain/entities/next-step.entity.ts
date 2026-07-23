// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: NextStep
// Toda oportunidade aberta DEVE possuir um Próximo Passo pendente (INV-02)
// ═══════════════════════════════════════════════════════════════════════════

import { NextStepStatus } from "../types";

export interface NextStepProps {
  id: number;
  opportunityId: number;
  ownerId: number | null;
  description: string;
  dueDate: Date;
  dueTime: string | null; // "HH:MM"
  objective: string | null;
  status: NextStepStatus;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateNextStepInput {
  opportunityId: number;
  ownerId?: number | null;
  description: string;
  dueDate: Date | string; // Date ou "YYYY-MM-DD"
  dueTime?: string | null;
  objective?: string | null;
}

export class NextStep {
  private constructor(private props: NextStepProps) {}

  // ─── FACTORY ─────────────────────────────────────────────────────────────

  static create(input: CreateNextStepInput): NextStep {
    if (!input.opportunityId || input.opportunityId <= 0) {
      throw new NextStepValidationError("Próximo Passo deve estar vinculado a uma Oportunidade");
    }

    if (!input.description || input.description.trim().length < 3) {
      throw new NextStepValidationError("Descrição do Próximo Passo é obrigatória (mínimo 3 caracteres)");
    }

    const dueDate = typeof input.dueDate === "string"
      ? new Date(input.dueDate + "T00:00:00")
      : input.dueDate;

    if (isNaN(dueDate.getTime())) {
      throw new NextStepValidationError("Data do Próximo Passo é inválida");
    }

    // Valida hora se fornecida
    if (input.dueTime && !/^\d{2}:\d{2}$/.test(input.dueTime)) {
      throw new NextStepValidationError("Hora deve estar no formato HH:MM");
    }

    return new NextStep({
      id: 0,
      opportunityId: input.opportunityId,
      ownerId: input.ownerId ?? null,
      description: input.description.trim(),
      dueDate,
      dueTime: input.dueTime ?? null,
      objective: input.objective?.trim() || null,
      status: NextStepStatus.PENDENTE,
      createdAt: new Date(),
      completedAt: null,
    });
  }

  static reconstitute(props: NextStepProps): NextStep {
    return new NextStep(props);
  }

  // ─── BEHAVIOR ────────────────────────────────────────────────────────────

  /** Marca como concluído */
  complete(): void {
    if (this.props.status !== NextStepStatus.PENDENTE) {
      throw new NextStepValidationError(
        `Apenas próximos passos pendentes podem ser concluídos. Status atual: ${this.props.status}`
      );
    }
    this.props.status = NextStepStatus.CONCLUIDO;
    this.props.completedAt = new Date();
  }

  /** Cancela o próximo passo */
  cancel(): void {
    if (this.props.status !== NextStepStatus.PENDENTE) {
      throw new NextStepValidationError("Apenas próximos passos pendentes podem ser cancelados");
    }
    this.props.status = NextStepStatus.CANCELADO;
  }

  /** Marca como expirado (chamado pelo cron) */
  markExpired(): void {
    if (this.props.status !== NextStepStatus.PENDENTE) {
      return; // já não está pendente
    }
    this.props.status = NextStepStatus.EXPIRADO;
  }

  /** Reagenda (nova data/hora) */
  reschedule(newDueDate: Date | string, newDueTime?: string | null): void {
    const dueDate = typeof newDueDate === "string"
      ? new Date(newDueDate + "T00:00:00")
      : newDueDate;

    if (isNaN(dueDate.getTime())) {
      throw new NextStepValidationError("Nova data é inválida");
    }

    this.props.dueDate = dueDate;
    if (newDueTime !== undefined) {
      this.props.dueTime = newDueTime;
    }
    // Se estava expirado, volta para pendente
    if (this.props.status === NextStepStatus.EXPIRADO) {
      this.props.status = NextStepStatus.PENDENTE;
    }
  }

  // ─── GETTERS ─────────────────────────────────────────────────────────────

  get id(): number { return this.props.id; }
  get opportunityId(): number { return this.props.opportunityId; }
  get ownerId(): number | null { return this.props.ownerId; }
  get description(): string { return this.props.description; }
  get dueDate(): Date { return this.props.dueDate; }
  get dueTime(): string | null { return this.props.dueTime; }
  get objective(): string | null { return this.props.objective; }
  get status(): NextStepStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get completedAt(): Date | null { return this.props.completedAt; }

  get isPending(): boolean { return this.props.status === NextStepStatus.PENDENTE; }
  get isCompleted(): boolean { return this.props.status === NextStepStatus.CONCLUIDO; }
  get isExpired(): boolean { return this.props.status === NextStepStatus.EXPIRADO; }

  get isOverdue(): boolean {
    if (!this.isPending) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.props.dueDate < today;
  }

  get isDueToday(): boolean {
    if (!this.isPending) return false;
    const today = new Date();
    return (
      this.props.dueDate.getDate() === today.getDate() &&
      this.props.dueDate.getMonth() === today.getMonth() &&
      this.props.dueDate.getFullYear() === today.getFullYear()
    );
  }

  get daysUntilDue(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(this.props.dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  // ─── PERSISTENCE ─────────────────────────────────────────────────────────

  toPersistence() {
    return {
      id: this.props.id || undefined,
      opportunityId: this.props.opportunityId,
      ownerId: this.props.ownerId,
      description: this.props.description,
      dueDate: this.props.dueDate.toISOString().split("T")[0],
      dueTime: this.props.dueTime,
      objective: this.props.objective,
      status: this.props.status,
      createdAt: this.props.createdAt,
      completedAt: this.props.completedAt,
    };
  }
}

// ─── ERROR ───────────────────────────────────────────────────────────────────

export class NextStepValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NextStepValidationError";
  }
}
