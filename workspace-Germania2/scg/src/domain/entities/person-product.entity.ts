// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: PersonProduct
// Representa um produto/seguro contratado por uma Pessoa
// ═══════════════════════════════════════════════════════════════════════════

import { ProductStatus, ProductSource } from "../types";
import { Money } from "../value-objects/money";

export interface PersonProductProps {
  id: number;
  personId: number;
  productTypeId: number;
  policyNumber: string | null;
  insurer: string | null;
  status: ProductStatus;
  startDate: Date | null;
  renewalDate: Date | null;
  premiumValue: Money | null;
  erpPolicyId: string | null;
  source: ProductSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePersonProductInput {
  personId: number;
  productTypeId: number;
  policyNumber?: string | null;
  insurer?: string | null;
  status?: ProductStatus;
  startDate?: Date | string | null;
  renewalDate?: Date | string | null;
  premiumValue?: number | string | null;
  erpPolicyId?: string | null;
  source?: ProductSource;
}

export class PersonProduct {
  private constructor(private props: PersonProductProps) {}

  // ─── FACTORY ─────────────────────────────────────────────────────────────

  static create(input: CreatePersonProductInput): PersonProduct {
    if (!input.personId || input.personId <= 0) {
      throw new PersonProductValidationError("Produto deve estar vinculado a uma Pessoa");
    }
    if (!input.productTypeId || input.productTypeId <= 0) {
      throw new PersonProductValidationError("Tipo de produto é obrigatório");
    }

    const parseDate = (d: Date | string | null | undefined): Date | null => {
      if (!d) return null;
      const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
      return isNaN(date.getTime()) ? null : date;
    };

    return new PersonProduct({
      id: 0,
      personId: input.personId,
      productTypeId: input.productTypeId,
      policyNumber: input.policyNumber?.trim() || null,
      insurer: input.insurer?.trim() || null,
      status: input.status ?? ProductStatus.ATIVA,
      startDate: parseDate(input.startDate),
      renewalDate: parseDate(input.renewalDate),
      premiumValue: Money.optional(input.premiumValue),
      erpPolicyId: input.erpPolicyId ?? null,
      source: input.source ?? ProductSource.MANUAL,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: PersonProductProps): PersonProduct {
    return new PersonProduct(props);
  }

  // ─── BEHAVIOR ────────────────────────────────────────────────────────────

  activate(): void {
    this.props.status = ProductStatus.ATIVA;
    this.props.updatedAt = new Date();
  }

  expire(): void {
    this.props.status = ProductStatus.VENCIDA;
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    this.props.status = ProductStatus.CANCELADA;
    this.props.updatedAt = new Date();
  }

  updateRenewalDate(newDate: Date | string): void {
    const date = typeof newDate === "string" ? new Date(newDate + "T00:00:00") : newDate;
    if (isNaN(date.getTime())) {
      throw new PersonProductValidationError("Data de renovação inválida");
    }
    this.props.renewalDate = date;
    this.props.updatedAt = new Date();
  }

  // ─── GETTERS ─────────────────────────────────────────────────────────────

  get id(): number { return this.props.id; }
  get personId(): number { return this.props.personId; }
  get productTypeId(): number { return this.props.productTypeId; }
  get policyNumber(): string | null { return this.props.policyNumber; }
  get insurer(): string | null { return this.props.insurer; }
  get status(): ProductStatus { return this.props.status; }
  get startDate(): Date | null { return this.props.startDate; }
  get renewalDate(): Date | null { return this.props.renewalDate; }
  get premiumValue(): Money | null { return this.props.premiumValue; }
  get erpPolicyId(): string | null { return this.props.erpPolicyId; }
  get source(): ProductSource { return this.props.source; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get isActive(): boolean { return this.props.status === ProductStatus.ATIVA; }
  get isFromErp(): boolean { return this.props.source === ProductSource.ERP; }

  /** Dias até a renovação (negativo se já passou) */
  get daysUntilRenewal(): number | null {
    if (!this.props.renewalDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const renewal = new Date(this.props.renewalDate);
    renewal.setHours(0, 0, 0, 0);
    return Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  /** Se está na janela de renovação (≤ 45 dias) */
  get isRenewalApproaching(): boolean {
    const days = this.daysUntilRenewal;
    return days !== null && days >= 0 && days <= 45;
  }

  // ─── PERSISTENCE ─────────────────────────────────────────────────────────

  toPersistence() {
    return {
      id: this.props.id || undefined,
      personId: this.props.personId,
      productTypeId: this.props.productTypeId,
      policyNumber: this.props.policyNumber,
      insurer: this.props.insurer,
      status: this.props.status,
      startDate: this.props.startDate?.toISOString().split("T")[0] ?? null,
      renewalDate: this.props.renewalDate?.toISOString().split("T")[0] ?? null,
      premiumValue: this.props.premiumValue?.reais ?? null,
      erpPolicyId: this.props.erpPolicyId,
      source: this.props.source,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}

export class PersonProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonProductValidationError";
  }
}
