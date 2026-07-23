// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: Opportunity
// Negociação comercial real, vinculada a uma Pessoa e a um Produto.
// ═══════════════════════════════════════════════════════════════════════════

import {
  ContactSource,
  EntryChannel,
  OpportunityStatus,
  OpportunityType,
  type AttributionSnapshot,
  type StageKind,
} from "../types";
import { Money } from "../value-objects/money";

export interface OpportunityProps {
  id: number;
  personId: number;
  leadId: number | null;
  personProductId: number | null;
  crossSellSuggestionId: number | null;
  productTypeId: number;
  pipelineId: number;
  stageId: number;
  ownerId: number;
  createdById: number | null;
  type: OpportunityType;
  estimatedValue: Money | null;
  probability: number;
  attribution: AttributionSnapshot;
  renewalKey: string | null;
  status: OpportunityStatus;
  lostReason: string | null;
  notes: string | null;
  createdAt: Date;
  lastMovementAt: Date;
  closedAt: Date | null;
}

export interface CreateOpportunityInput {
  personId: number;
  leadId?: number | null;
  personProductId?: number | null;
  crossSellSuggestionId?: number | null;
  productTypeId: number;
  pipelineId: number;
  stageId: number;
  ownerId: number;
  createdById?: number | null;
  type: OpportunityType;
  attribution: AttributionSnapshot;
  renewalKey?: string | null;
  estimatedValue?: number | string | null;
  probability?: number;
  notes?: string | null;
}

export class Opportunity {
  private constructor(private props: OpportunityProps) {}

  static create(input: CreateOpportunityInput): Opportunity {
    Opportunity.assertPositiveId(input.personId, "Pessoa");
    Opportunity.assertPositiveId(input.productTypeId, "Produto");
    Opportunity.assertPositiveId(input.pipelineId, "Pipeline");
    Opportunity.assertPositiveId(input.stageId, "Etapa");
    Opportunity.assertPositiveId(input.ownerId, "Responsável");
    Opportunity.assertOptionalPositiveId(input.leadId, "Lead");
    Opportunity.assertOptionalPositiveId(
      input.personProductId,
      "Produto contratado"
    );
    Opportunity.assertOptionalPositiveId(
      input.crossSellSuggestionId,
      "Sugestão de cross-selling"
    );
    Opportunity.assertOptionalPositiveId(input.createdById, "Criado por");
    Opportunity.assertAttribution(input.attribution);
    if (input.attribution.referredByPersonId === input.personId) {
      throw new OpportunityValidationError(
        "Uma pessoa não pode indicar a si própria"
      );
    }

    if (input.leadId && input.type !== OpportunityType.NOVO_NEGOCIO) {
      throw new OpportunityValidationError(
        "Oportunidade originada de Lead deve ser do tipo novo negócio"
      );
    }
    if (input.type === OpportunityType.RENOVACAO) {
      if (!input.personProductId) {
        throw new OpportunityValidationError(
          "Renovação deve identificar o produto/apólice renovado"
        );
      }
      if (!input.renewalKey?.trim()) {
        throw new OpportunityValidationError(
          "Renovação deve possuir uma chave de ciclo"
        );
      }
    } else if (input.personProductId || input.renewalKey) {
      throw new OpportunityValidationError(
        "Produto contratado e chave de renovação só são válidos em renovação"
      );
    }
    if (
      input.type === OpportunityType.CROSS_SELL &&
      input.leadId
    ) {
      throw new OpportunityValidationError(
        "Cross-selling deve nascer diretamente como Oportunidade"
      );
    }

    const probability = input.probability ?? 50;
    if (probability < 0 || probability > 100) {
      throw new OpportunityValidationError(
        "Probabilidade deve estar entre 0 e 100"
      );
    }

    const now = new Date();
    return new Opportunity({
      id: 0,
      personId: input.personId,
      leadId: input.leadId ?? null,
      personProductId: input.personProductId ?? null,
      crossSellSuggestionId: input.crossSellSuggestionId ?? null,
      productTypeId: input.productTypeId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      ownerId: input.ownerId,
      createdById: input.createdById ?? null,
      type: input.type,
      estimatedValue: Money.optional(input.estimatedValue),
      probability,
      attribution: { ...input.attribution },
      renewalKey: input.renewalKey?.trim() || null,
      status: OpportunityStatus.ABERTA,
      lostReason: null,
      notes: input.notes?.trim() || null,
      createdAt: now,
      lastMovementAt: now,
      closedAt: null,
    });
  }

  static reconstitute(props: OpportunityProps): Opportunity {
    return new Opportunity({
      ...props,
      attribution: { ...props.attribution },
    });
  }

  /**
   * Executa a transição completa. A etapa final e o status nunca divergem.
   * A aplicação ainda deve validar que a etapa pertence ao mesmo pipeline.
   */
  moveToStage(
    newStageId: number,
    stageKind: StageKind,
    lostReason?: string | null
  ): void {
    if (!this.isOpen) {
      throw new OpportunityValidationError(
        "Apenas oportunidades abertas podem mudar de etapa"
      );
    }
    Opportunity.assertPositiveId(newStageId, "Etapa");
    if (newStageId === this.props.stageId && stageKind === "open") return;

    if (stageKind === "lost") {
      const reason = lostReason?.trim();
      if (!reason || reason.length < 3) {
        throw new OpportunityValidationError(
          "Motivo da perda é obrigatório (mínimo 3 caracteres)"
        );
      }
      this.props.status = OpportunityStatus.PERDIDA;
      this.props.lostReason = reason;
      this.props.probability = 0;
      this.props.closedAt = new Date();
    } else if (stageKind === "won") {
      this.props.status = OpportunityStatus.GANHA;
      this.props.lostReason = null;
      this.props.probability = 100;
      this.props.closedAt = new Date();
    } else {
      this.props.status = OpportunityStatus.ABERTA;
    }

    this.props.stageId = newStageId;
    this.props.lastMovementAt = new Date();
  }

  updateEstimatedValue(value: number | string | null): void {
    this.assertOpen();
    this.props.estimatedValue = Money.optional(value);
  }

  updateProbability(value: number): void {
    this.assertOpen();
    if (value < 0 || value > 100) {
      throw new OpportunityValidationError(
        "Probabilidade deve estar entre 0 e 100"
      );
    }
    this.props.probability = value;
  }

  updateNotes(notes: string | null): void {
    this.props.notes = notes?.trim() || null;
  }

  reassign(ownerId: number): void {
    this.assertOpen();
    Opportunity.assertPositiveId(ownerId, "Responsável");
    this.props.ownerId = ownerId;
    this.props.lastMovementAt = new Date();
  }

  get id(): number { return this.props.id; }
  get personId(): number { return this.props.personId; }
  get leadId(): number | null { return this.props.leadId; }
  get personProductId(): number | null { return this.props.personProductId; }
  get crossSellSuggestionId(): number | null {
    return this.props.crossSellSuggestionId;
  }
  get productTypeId(): number { return this.props.productTypeId; }
  get pipelineId(): number { return this.props.pipelineId; }
  get stageId(): number { return this.props.stageId; }
  get ownerId(): number { return this.props.ownerId; }
  get createdById(): number | null { return this.props.createdById; }
  get type(): OpportunityType { return this.props.type; }
  get estimatedValue(): Money | null { return this.props.estimatedValue; }
  get probability(): number { return this.props.probability; }
  get attribution(): Readonly<AttributionSnapshot> {
    return { ...this.props.attribution };
  }
  get renewalKey(): string | null { return this.props.renewalKey; }
  get status(): OpportunityStatus { return this.props.status; }
  get lostReason(): string | null { return this.props.lostReason; }
  get notes(): string | null { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }
  get lastMovementAt(): Date { return this.props.lastMovementAt; }
  get closedAt(): Date | null { return this.props.closedAt; }
  get isOpen(): boolean {
    return this.props.status === OpportunityStatus.ABERTA;
  }
  get isWon(): boolean {
    return this.props.status === OpportunityStatus.GANHA;
  }
  get isLost(): boolean {
    return this.props.status === OpportunityStatus.PERDIDA;
  }
  get daysStale(): number {
    return Math.floor(
      (Date.now() - this.props.lastMovementAt.getTime()) / 86_400_000
    );
  }

  toPersistence() {
    return {
      id: this.props.id || undefined,
      personId: this.props.personId,
      leadId: this.props.leadId,
      personProductId: this.props.personProductId,
      crossSellSuggestionId: this.props.crossSellSuggestionId,
      productTypeId: this.props.productTypeId,
      pipelineId: this.props.pipelineId,
      stageId: this.props.stageId,
      ownerId: this.props.ownerId,
      createdById: this.props.createdById,
      type: this.props.type,
      estimatedValue: this.props.estimatedValue?.reais ?? null,
      probability: this.props.probability,
      source: this.props.attribution.source,
      channel: this.props.attribution.channel,
      campaign: this.props.attribution.campaign,
      referredByPersonId: this.props.attribution.referredByPersonId,
      sourceDetail: this.props.attribution.sourceDetail,
      renewalKey: this.props.renewalKey,
      status: this.props.status,
      lostReason: this.props.lostReason,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      lastMovementAt: this.props.lastMovementAt,
      closedAt: this.props.closedAt,
    };
  }

  private assertOpen(): void {
    if (!this.isOpen) {
      throw new OpportunityValidationError(
        "Não é possível alterar oportunidade fechada"
      );
    }
  }

  private static assertAttribution(attribution: AttributionSnapshot): void {
    if (!Object.values(ContactSource).includes(attribution.source)) {
      throw new OpportunityValidationError("Origem do contato inválida");
    }
    if (!Object.values(EntryChannel).includes(attribution.channel)) {
      throw new OpportunityValidationError("Canal de entrada inválido");
    }
    Opportunity.assertOptionalPositiveId(
      attribution.referredByPersonId,
      "Pessoa indicadora"
    );
    if (
      attribution.source === ContactSource.INDICACAO &&
      !attribution.referredByPersonId &&
      !attribution.sourceDetail?.trim()
    ) {
      throw new OpportunityValidationError(
        "Indicação exige pessoa indicadora ou identificação textual"
      );
    }
    if (
      attribution.source === ContactSource.OUTRO &&
      !attribution.sourceDetail?.trim()
    ) {
      throw new OpportunityValidationError(
        "Origem 'outro' exige detalhamento"
      );
    }
  }

  private static assertPositiveId(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new OpportunityValidationError(`${field} deve ser um ID válido`);
    }
  }

  private static assertOptionalPositiveId(
    value: number | null | undefined,
    field: string
  ): void {
    if (value !== null && value !== undefined) {
      Opportunity.assertPositiveId(value, field);
    }
  }
}

export class OpportunityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpportunityValidationError";
  }
}
