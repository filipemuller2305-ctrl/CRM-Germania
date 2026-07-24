// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: Activity
// Ação realizada pelo consultor, vinculada à Pessoa e opcionalmente a um único
// processo comercial: Lead OU Oportunidade.
// ═══════════════════════════════════════════════════════════════════════════

import { ActivityType } from "../types";

export interface ActivityProps {
  id: number;
  personId: number;
  leadId: number | null;
  opportunityId: number | null;
  ownerId: number | null;
  type: ActivityType;
  description: string | null;
  createdAt: Date;
}

export interface CreateActivityInput {
  personId: number;
  leadId?: number | null;
  opportunityId?: number | null;
  ownerId?: number | null;
  type: ActivityType;
  description?: string | null;
}

export class Activity {
  private constructor(private props: ActivityProps) {}

  static create(input: CreateActivityInput): Activity {
    if (!Number.isInteger(input.personId) || input.personId <= 0) {
      throw new ActivityValidationError(
        "Atividade deve estar vinculada a uma Pessoa"
      );
    }
    if (input.leadId && input.opportunityId) {
      throw new ActivityValidationError(
        "Atividade não pode pertencer simultaneamente a Lead e Oportunidade"
      );
    }
    for (const [value, label] of [
      [input.leadId, "Lead"],
      [input.opportunityId, "Oportunidade"],
      [input.ownerId, "Responsável"],
    ] as const) {
      if (value !== null && value !== undefined && value <= 0) {
        throw new ActivityValidationError(`${label} deve ser um ID válido`);
      }
    }
    if (!Object.values(ActivityType).includes(input.type)) {
      throw new ActivityValidationError(
        `Tipo de atividade inválido: ${input.type}`
      );
    }

    return new Activity({
      id: 0,
      personId: input.personId,
      leadId: input.leadId ?? null,
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

  get id(): number { return this.props.id; }
  get personId(): number { return this.props.personId; }
  get leadId(): number | null { return this.props.leadId; }
  get opportunityId(): number | null { return this.props.opportunityId; }
  get ownerId(): number | null { return this.props.ownerId; }
  get type(): ActivityType { return this.props.type; }
  get description(): string | null { return this.props.description; }
  get createdAt(): Date { return this.props.createdAt; }
  get isLinkedToLead(): boolean { return this.props.leadId !== null; }
  get isLinkedToOpportunity(): boolean {
    return this.props.opportunityId !== null;
  }
  get canGenerateNextStep(): boolean {
    return (
      this.props.opportunityId !== null &&
      this.props.type !== ActivityType.ANOTACAO
    );
  }

  toPersistence() {
    return {
      id: this.props.id || undefined,
      personId: this.props.personId,
      leadId: this.props.leadId,
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
