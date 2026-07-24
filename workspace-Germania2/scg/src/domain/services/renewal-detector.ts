// ═══════════════════════════════════════════════════════════════════════════
// Domain Service: RenewalDetector
// Detecta ciclos de renovação de forma idempotente.
// ═══════════════════════════════════════════════════════════════════════════

import { ProductStatus } from "../types";

export const RENEWAL_WINDOW_DAYS = 45;
export const RENEWAL_OVERDUE_LOOKBACK_DAYS = 90;

export interface RenewableProduct {
  personProductId: number;
  personId: number;
  personName: string;
  productTypeId: number;
  productTypeName: string;
  renewalDate: Date;
  status: ProductStatus;
  ownerId: number | null;
}

/** Qualquer oportunidade de renovação já criada, aberta ou fechada. */
export interface ExistingRenewalRef {
  renewalKey: string;
}

export interface RenewalCandidate {
  renewalKey: string;
  personProductId: number;
  personId: number;
  personName: string;
  productTypeId: number;
  productTypeName: string;
  renewalDate: Date;
  daysUntilRenewal: number;
  ownerId: number | null;
}

export class RenewalDetector {
  /**
   * A chave personProductId:data-do-ciclo impede duplicação mesmo se uma
   * oportunidade anterior já tiver sido perdida ou ganha.
   */
  detect(
    products: RenewableProduct[],
    existingRenewals: ExistingRenewalRef[],
    referenceDate: Date = new Date()
  ): RenewalCandidate[] {
    const today = RenewalDetector.atStartOfDay(referenceDate);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + RENEWAL_WINDOW_DAYS);
    const lookbackStart = new Date(today);
    lookbackStart.setDate(
      lookbackStart.getDate() - RENEWAL_OVERDUE_LOOKBACK_DAYS
    );

    const existingKeys = new Set(
      existingRenewals.map((opportunity) => opportunity.renewalKey)
    );
    const candidates: RenewalCandidate[] = [];

    for (const product of products) {
      if (product.status !== ProductStatus.ATIVA || !product.renewalDate) {
        continue;
      }

      const renewalDate = RenewalDetector.atStartOfDay(product.renewalDate);
      if (renewalDate < lookbackStart || renewalDate > windowEnd) continue;

      const renewalKey = RenewalDetector.buildRenewalKey(
        product.personProductId,
        renewalDate
      );
      if (existingKeys.has(renewalKey)) continue;

      candidates.push({
        renewalKey,
        personProductId: product.personProductId,
        personId: product.personId,
        personName: product.personName,
        productTypeId: product.productTypeId,
        productTypeName: product.productTypeName,
        renewalDate,
        daysUntilRenewal: Math.ceil(
          (renewalDate.getTime() - today.getTime()) / 86_400_000
        ),
        ownerId: product.ownerId,
      });
    }

    return candidates.sort(
      (a, b) => a.daysUntilRenewal - b.daysUntilRenewal
    );
  }

  static buildRenewalKey(
    personProductId: number,
    renewalDate: Date
  ): string {
    if (!Number.isInteger(personProductId) || personProductId <= 0) {
      throw new RenewalValidationError(
        "Produto contratado deve ser um ID válido"
      );
    }
    const normalized = RenewalDetector.atStartOfDay(renewalDate);
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, "0");
    const day = String(normalized.getDate()).padStart(2, "0");
    return `${personProductId}:${year}-${month}-${day}`;
  }

  static nextStepDueDate(
    renewalDate: Date,
    referenceDate: Date = new Date()
  ): Date {
    const dueDate = RenewalDetector.atStartOfDay(renewalDate);
    dueDate.setDate(dueDate.getDate() - 30);

    const today = RenewalDetector.atStartOfDay(referenceDate);
    if (dueDate <= today) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    return dueDate;
  }

  private static atStartOfDay(value: Date): Date {
    const result = new Date(value);
    if (Number.isNaN(result.getTime())) {
      throw new RenewalValidationError("Data de renovação inválida");
    }
    result.setHours(0, 0, 0, 0);
    return result;
  }
}

export class RenewalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenewalValidationError";
  }
}
