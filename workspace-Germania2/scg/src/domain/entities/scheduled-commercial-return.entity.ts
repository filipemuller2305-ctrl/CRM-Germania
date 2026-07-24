import {
  OpportunityCloseOutcome,
  ScheduledCommercialReturnStatus,
  type OpportunityCloseOutcome as OpportunityCloseOutcomeType,
  type ScheduledCommercialReturnStatus as ScheduledCommercialReturnStatusType,
} from "../types";

export const COMMERCIAL_RETURN_ADVANCE_DAYS = 45;

export interface ScheduledCommercialReturnProps {
  id: number;
  personId: number;
  sourceOpportunityId: number;
  createdOpportunityId: number | null;
  productTypeId: number;
  ownerId: number;
  closeOutcome: OpportunityCloseOutcomeType;
  nextExpirationDate: Date;
  scheduledFor: Date;
  notes: string;
  status: ScheduledCommercialReturnStatusType;
  createdAt: Date;
  processedAt: Date | null;
  cancelledAt: Date | null;
}

export interface ScheduleCommercialReturnInput {
  personId: number;
  sourceOpportunityId: number;
  productTypeId: number;
  ownerId: number;
  closeOutcome: OpportunityCloseOutcomeType;
  nextExpirationDate: Date | string;
  notes: string;
  referenceDate?: Date;
}

const EXTERNAL_CONTRACT_OUTCOMES: OpportunityCloseOutcomeType[] = [
  OpportunityCloseOutcome.RENOVOU_OUTRA_CORRETORA,
  OpportunityCloseOutcome.RENOVOU_DIRETO_BANCO_SEGURADORA,
  OpportunityCloseOutcome.CONTRATOU_PROTECAO_VEICULAR,
];

export class ScheduledCommercialReturn {
  private constructor(private props: ScheduledCommercialReturnProps) {}

  static schedule(input: ScheduleCommercialReturnInput): ScheduledCommercialReturn {
    ScheduledCommercialReturn.assertPositiveId(input.personId, "Pessoa");
    ScheduledCommercialReturn.assertPositiveId(
      input.sourceOpportunityId,
      "Oportunidade de origem"
    );
    ScheduledCommercialReturn.assertPositiveId(
      input.productTypeId,
      "Produto"
    );
    ScheduledCommercialReturn.assertPositiveId(input.ownerId, "Responsável");

    if (!EXTERNAL_CONTRACT_OUTCOMES.includes(input.closeOutcome)) {
      throw new ScheduledCommercialReturnValidationError(
        "Retorno comercial só pode ser programado quando o cliente contratou fora da Germânia"
      );
    }

    const notes = input.notes.trim();
    if (notes.length < 3) {
      throw new ScheduledCommercialReturnValidationError(
        "Observação do retorno comercial é obrigatória"
      );
    }

    const nextExpirationDate = ScheduledCommercialReturn.asDate(
      input.nextExpirationDate,
      "Próximo vencimento"
    );
    const referenceDate = ScheduledCommercialReturn.atStartOfDay(
      input.referenceDate ?? new Date()
    );
    if (nextExpirationDate <= referenceDate) {
      throw new ScheduledCommercialReturnValidationError(
        "Próximo vencimento deve ser posterior à data atual"
      );
    }

    return new ScheduledCommercialReturn({
      id: 0,
      personId: input.personId,
      sourceOpportunityId: input.sourceOpportunityId,
      createdOpportunityId: null,
      productTypeId: input.productTypeId,
      ownerId: input.ownerId,
      closeOutcome: input.closeOutcome,
      nextExpirationDate,
      scheduledFor: ScheduledCommercialReturn.calculateScheduledFor(
        nextExpirationDate
      ),
      notes,
      status: ScheduledCommercialReturnStatus.PENDENTE,
      createdAt: new Date(),
      processedAt: null,
      cancelledAt: null,
    });
  }

  static reconstitute(
    props: ScheduledCommercialReturnProps
  ): ScheduledCommercialReturn {
    return new ScheduledCommercialReturn({ ...props });
  }

  static calculateScheduledFor(nextExpirationDate: Date | string): Date {
    const scheduledFor = ScheduledCommercialReturn.asDate(
      nextExpirationDate,
      "Próximo vencimento"
    );
    scheduledFor.setDate(
      scheduledFor.getDate() - COMMERCIAL_RETURN_ADVANCE_DAYS
    );
    return scheduledFor;
  }

  markProcessed(createdOpportunityId: number): void {
    if (this.props.status !== ScheduledCommercialReturnStatus.PENDENTE) {
      throw new ScheduledCommercialReturnValidationError(
        "Somente retorno pendente pode ser processado"
      );
    }
    ScheduledCommercialReturn.assertPositiveId(
      createdOpportunityId,
      "Oportunidade criada"
    );
    this.props.createdOpportunityId = createdOpportunityId;
    this.props.status = ScheduledCommercialReturnStatus.PROCESSADO;
    this.props.processedAt = new Date();
  }

  cancel(): void {
    if (this.props.status !== ScheduledCommercialReturnStatus.PENDENTE) {
      throw new ScheduledCommercialReturnValidationError(
        "Somente retorno pendente pode ser cancelado"
      );
    }
    this.props.status = ScheduledCommercialReturnStatus.CANCELADO;
    this.props.cancelledAt = new Date();
  }

  get id(): number { return this.props.id; }
  get personId(): number { return this.props.personId; }
  get sourceOpportunityId(): number { return this.props.sourceOpportunityId; }
  get createdOpportunityId(): number | null {
    return this.props.createdOpportunityId;
  }
  get productTypeId(): number { return this.props.productTypeId; }
  get ownerId(): number { return this.props.ownerId; }
  get closeOutcome(): OpportunityCloseOutcomeType {
    return this.props.closeOutcome;
  }
  get nextExpirationDate(): Date { return this.props.nextExpirationDate; }
  get scheduledFor(): Date { return this.props.scheduledFor; }
  get notes(): string { return this.props.notes; }
  get status(): ScheduledCommercialReturnStatusType {
    return this.props.status;
  }
  get createdAt(): Date { return this.props.createdAt; }
  get processedAt(): Date | null { return this.props.processedAt; }
  get cancelledAt(): Date | null { return this.props.cancelledAt; }
  get recoveryKey(): string { return `commercial-return:${this.props.id}`; }

  toPersistence() {
    return {
      id: this.props.id || undefined,
      personId: this.props.personId,
      sourceOpportunityId: this.props.sourceOpportunityId,
      createdOpportunityId: this.props.createdOpportunityId,
      productTypeId: this.props.productTypeId,
      ownerId: this.props.ownerId,
      closeOutcome: this.props.closeOutcome,
      nextExpirationDate: this.props.nextExpirationDate,
      scheduledFor: this.props.scheduledFor,
      notes: this.props.notes,
      status: this.props.status,
      createdAt: this.props.createdAt,
      processedAt: this.props.processedAt,
      cancelledAt: this.props.cancelledAt,
    };
  }

  private static asDate(value: Date | string, field: string): Date {
    const date =
      value instanceof Date
        ? new Date(value)
        : new Date(
            /^\d{4}-\d{2}-\d{2}$/.test(value)
              ? `${value}T00:00:00`
              : value
          );
    if (Number.isNaN(date.getTime())) {
      throw new ScheduledCommercialReturnValidationError(
        `${field} possui data inválida`
      );
    }
    return ScheduledCommercialReturn.atStartOfDay(date);
  }

  private static atStartOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private static assertPositiveId(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new ScheduledCommercialReturnValidationError(
        `${field} deve ser um ID válido`
      );
    }
  }
}

export class ScheduledCommercialReturnValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduledCommercialReturnValidationError";
  }
}
