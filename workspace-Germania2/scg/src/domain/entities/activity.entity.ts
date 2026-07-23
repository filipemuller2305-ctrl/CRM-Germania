// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: Activity
// Representa uma ação realizada pelo consultor (ligação, email, reunião, etc)
// ═══════════════════════════════════════════════════════════════════════════

import { ActivityType } from "../types";

export interface ActivityProps {
  id: number;
  personId: number;
  opportunityId: number | null;
  ownerId: number | null;
  type: ActivityType;
  description: string | null;
  createdAt: Date;
}

export interface CreateActivityInput {
  personId: number;
  opportunityId?: number | null;
  ownerId?: number | null;
  type: ActivityType;
  description?: string | null;
}

export class Activity {
  private constructor(private props: ActivityProps) {}

  // ─── FACTORY ─────────────────────────────────────────────────────────────

  static create(input: CreateActivityInput): Activity {
    if (!input.personId || input.personId <= 0) {
      throw new ActivityValidationError("Atividade deve estar vinculada a uma Pessoa");
    }

    if (!Object.values(ActivityType).includes(input.type)) {
      throw new ActivityValidationError(
        `Tipo de atividade inválido: ${input.type}. Tipos válidos: ${Object.values(ActivityType).join(", ")}`
      );
    }

    return new Activity({
      id: 0,
      personId: input.personId,
      opportunityId: input.opportunityId ?? null,
      ownerId: input.ownerId ?? null,
      type: input.type,
      description: input.description?.trim() || null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ActivityProps): Activity {
    return new Activity(props);
  }

  // ─── GETTERS ─────────────────────────────────────────────────────────────

  get id(): number { return this.props.id; }
  get personId(): number { return this.props.personId; }
  get opportunityId(): number | null { return this.props.opportunityId; }
  get ownerId(): number | null { return this.props.ownerId; }
  get type(): ActivityType { return this.props.type; }
  get description(): string | null { return this.props.description; }
  get createdAt(): Date { return this.props.createdAt; }

  /** Se esta atividade está vinculada a uma oportunidade */
  get isLinkedToOpportunity(): boolean {
    return this.props.opportunityId !== null;
  }

  /** Se esta atividade pode gerar um próximo passo (todas podem, exceto anotação) */
  get canGenerateNextStep(): boolean {
    return this.props.type !== ActivityType.ANOTACAO;
  }

  // ─── PERSISTENCE ─────────────────────────────────────────────────────────

  toPersistence() {
    return {
      id: this.props.id || undefined,
      personId: this.props.personId,
      opportunityId: this.props.opportunityId,
      ownerId: this.props.ownerId,
      type: this.props.type,
      description: this.props.description,
      createdAt: this.props.createdAt,
    };
  }
}

export class ActivityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActivityValidationError";
  }
}
