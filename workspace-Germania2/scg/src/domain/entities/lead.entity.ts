// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: Lead
// Processo temporário de entrada e qualificação de um contato.
// ═══════════════════════════════════════════════════════════════════════════

import {
  ContactSource,
  EntryChannel,
  LeadDiscardReason,
  LeadStatus,
  type AttributionSnapshot,
} from "../types";

export interface LeadProps {
  id: number;
  personId: number;
  productTypeId: number | null;
  source: ContactSource;
  channel: EntryChannel;
  campaign: string | null;
  referredByPersonId: number | null;
  sourceDetail: string | null;
  capturedById: number;
  ownerId: number | null;
  status: LeadStatus;
  opportunityId: number | null;
  discardReason: LeadDiscardReason | null;
  discardNotes: string | null;
  createdAt: Date;
  qualificationStartedAt: Date | null;
  qualifiedAt: Date | null;
  convertedAt: Date | null;
  discardedAt: Date | null;
  archivedAt: Date | null;
}

export interface CreateLeadInput {
  personId: number;
  productTypeId?: number | null;
  source: ContactSource;
  channel: EntryChannel;
  campaign?: string | null;
  referredByPersonId?: number | null;
  sourceDetail?: string | null;
  capturedById: number;
  ownerId?: number | null;
}

export class Lead {
  private constructor(private props: LeadProps) {}

  static create(input: CreateLeadInput): Lead {
    Lead.assertPositiveId(input.personId, "Pessoa");
    Lead.assertPositiveId(input.capturedById, "Responsável pela captura");
    Lead.assertOptionalPositiveId(input.productTypeId, "Produto de interesse");
    Lead.assertOptionalPositiveId(input.ownerId, "Responsável pelo Lead");
    Lead.assertOptionalPositiveId(input.referredByPersonId, "Pessoa indicadora");

    if (input.referredByPersonId === input.personId) {
      throw new LeadValidationError("Uma pessoa não pode indicar a si própria");
    }

    const sourceDetail = input.sourceDetail?.trim() || null;
    if (
      input.source === ContactSource.INDICACAO &&
      !input.referredByPersonId &&
      !sourceDetail
    ) {
      throw new LeadValidationError(
        "Indicação exige a pessoa indicadora ou uma identificação textual"
      );
    }
    if (input.source === ContactSource.OUTRO && !sourceDetail) {
      throw new LeadValidationError("Origem 'outro' exige detalhamento");
    }

    return new Lead({
      id: 0,
      personId: input.personId,
      productTypeId: input.productTypeId ?? null,
      source: input.source,
      channel: input.channel,
      campaign: input.campaign?.trim() || null,
      referredByPersonId: input.referredByPersonId ?? null,
      sourceDetail,
      capturedById: input.capturedById,
      ownerId: input.ownerId ?? null,
      status: input.ownerId ? LeadStatus.EM_QUALIFICACAO : LeadStatus.NOVO,
      opportunityId: null,
      discardReason: null,
      discardNotes: null,
      createdAt: new Date(),
      qualificationStartedAt: input.ownerId ? new Date() : null,
      qualifiedAt: null,
      convertedAt: null,
      discardedAt: null,
      archivedAt: null,
    });
  }

  static reconstitute(props: LeadProps): Lead {
    return new Lead(props);
  }

  startQualification(ownerId: number): void {
    this.assertMutable();
    Lead.assertPositiveId(ownerId, "Responsável pelo Lead");
    this.props.ownerId = ownerId;
    this.props.status = LeadStatus.EM_QUALIFICACAO;
    this.props.qualificationStartedAt ??= new Date();
  }

  setProductInterest(productTypeId: number): void {
    this.assertMutable();
    Lead.assertPositiveId(productTypeId, "Produto de interesse");
    this.props.productTypeId = productTypeId;
  }

  reassign(ownerId: number): void {
    this.assertMutable();
    Lead.assertPositiveId(ownerId, "Responsável pelo Lead");
    this.props.ownerId = ownerId;
    this.props.qualificationStartedAt ??= new Date();
    if (this.props.status === LeadStatus.NOVO) {
      this.props.status = LeadStatus.EM_QUALIFICACAO;
    }
  }

  /**
   * Conversão ocorre quando há intenção comercial real, como pedido de
   * cotação. A criação da Oportunidade e esta transição devem ser atômicas.
   */
  convert(opportunityId: number): void {
    this.assertMutable();
    Lead.assertPositiveId(opportunityId, "Oportunidade");
    if (!this.props.ownerId) {
      throw new LeadValidationError(
        "Lead precisa ter responsável antes da conversão"
      );
    }
    if (!this.props.productTypeId) {
      throw new LeadValidationError(
        "Produto de interesse é obrigatório para converter o Lead"
      );
    }

    const now = new Date();
    this.props.status = LeadStatus.CONVERTIDO;
    this.props.opportunityId = opportunityId;
    this.props.qualifiedAt ??= now;
    this.props.convertedAt = now;
  }

  discard(reason: LeadDiscardReason, notes?: string | null): void {
    this.assertMutable();
    if (!Object.values(LeadDiscardReason).includes(reason)) {
      throw new LeadValidationError("Motivo de descarte inválido");
    }
    const normalizedNotes = notes?.trim() || null;
    if (reason === LeadDiscardReason.OUTRO && !normalizedNotes) {
      throw new LeadValidationError(
        "Descarte com motivo 'outro' exige explicação"
      );
    }

    this.props.status = LeadStatus.DESCARTADO;
    this.props.discardReason = reason;
    this.props.discardNotes = normalizedNotes;
    this.props.discardedAt = new Date();
  }

  archive(): void {
    if (this.props.status !== LeadStatus.DESCARTADO) {
      throw new LeadValidationError(
        "Somente Leads descartados podem ser arquivados"
      );
    }
    this.props.status = LeadStatus.ARQUIVADO;
    this.props.archivedAt = new Date();
  }

  toAttributionSnapshot(): AttributionSnapshot {
    return {
      source: this.props.source,
      channel: this.props.channel,
      campaign: this.props.campaign,
      referredByPersonId: this.props.referredByPersonId,
      sourceDetail: this.props.sourceDetail,
    };
  }

  get id(): number { return this.props.id; }
  get personId(): number { return this.props.personId; }
  get productTypeId(): number | null { return this.props.productTypeId; }
  get source(): ContactSource { return this.props.source; }
  get channel(): EntryChannel { return this.props.channel; }
  get campaign(): string | null { return this.props.campaign; }
  get referredByPersonId(): number | null {
    return this.props.referredByPersonId;
  }
  get sourceDetail(): string | null { return this.props.sourceDetail; }
  get capturedById(): number { return this.props.capturedById; }
  get ownerId(): number | null { return this.props.ownerId; }
  get status(): LeadStatus { return this.props.status; }
  get opportunityId(): number | null { return this.props.opportunityId; }
  get discardReason(): LeadDiscardReason | null {
    return this.props.discardReason;
  }
  get discardNotes(): string | null { return this.props.discardNotes; }
  get createdAt(): Date { return this.props.createdAt; }
  get qualificationStartedAt(): Date | null {
    return this.props.qualificationStartedAt;
  }
  get qualifiedAt(): Date | null { return this.props.qualifiedAt; }
  get convertedAt(): Date | null { return this.props.convertedAt; }
  get discardedAt(): Date | null { return this.props.discardedAt; }
  get archivedAt(): Date | null { return this.props.archivedAt; }
  get isOpen(): boolean {
    return (
      this.props.status === LeadStatus.NOVO ||
      this.props.status === LeadStatus.EM_QUALIFICACAO
    );
  }

  toPersistence() {
    return {
      id: this.props.id || undefined,
      personId: this.props.personId,
      productTypeId: this.props.productTypeId,
      source: this.props.source,
      channel: this.props.channel,
      campaign: this.props.campaign,
      referredByPersonId: this.props.referredByPersonId,
      sourceDetail: this.props.sourceDetail,
      capturedById: this.props.capturedById,
      ownerId: this.props.ownerId,
      status: this.props.status,
      opportunityId: this.props.opportunityId,
      discardReason: this.props.discardReason,
      discardNotes: this.props.discardNotes,
      createdAt: this.props.createdAt,
      qualificationStartedAt: this.props.qualificationStartedAt,
      qualifiedAt: this.props.qualifiedAt,
      convertedAt: this.props.convertedAt,
      discardedAt: this.props.discardedAt,
      archivedAt: this.props.archivedAt,
    };
  }

  private assertMutable(): void {
    if (!this.isOpen) {
      throw new LeadValidationError(
        `Lead ${this.props.status} não pode mais ser alterado`
      );
    }
  }

  private static assertPositiveId(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new LeadValidationError(`${field} deve ser um ID válido`);
    }
  }

  private static assertOptionalPositiveId(
    value: number | null | undefined,
    field: string
  ): void {
    if (value !== null && value !== undefined) {
      Lead.assertPositiveId(value, field);
    }
  }
}

export class LeadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadValidationError";
  }
}
