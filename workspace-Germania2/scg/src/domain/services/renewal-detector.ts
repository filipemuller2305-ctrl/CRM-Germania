// ═══════════════════════════════════════════════════════════════════════════
// Domain Service: RenewalDetector
// Detecta produtos na janela de renovação e gera oportunidades automáticas
// INV-09: renewal_date ≤ 45 dias → criar oportunidade de renovação
// ═══════════════════════════════════════════════════════════════════════════

import { ProductStatus } from "../types";

/** Janela de renovação em dias */
export const RENEWAL_WINDOW_DAYS = 45;

/** Dados mínimos de um produto para avaliação de renovação */
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

/** Dados mínimos de uma oportunidade aberta */
export interface OpenOpportunityRef {
  personId: number;
  productTypeId: number;
}

/** Resultado da detecção */
export interface RenewalCandidate {
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
   * Dada uma lista de produtos renováveis e oportunidades abertas,
   * retorna quais produtos precisam de uma nova oportunidade de renovação.
   *
   * Critérios:
   * 1. Produto está ATIVO
   * 2. renewal_date está entre hoje e hoje + RENEWAL_WINDOW_DAYS
   * 3. NÃO existe oportunidade aberta para o mesmo produto + pessoa
   */
  detect(
    products: RenewableProduct[],
    openOpportunities: OpenOpportunityRef[]
  ): RenewalCandidate[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + RENEWAL_WINDOW_DAYS);

    // Index de oportunidades abertas por person+product
    const openOppSet = new Set(
      openOpportunities.map((o) => `${o.personId}:${o.productTypeId}`)
    );

    const candidates: RenewalCandidate[] = [];

    for (const product of products) {
      // 1. Deve estar ativo
      if (product.status !== ProductStatus.ATIVA) continue;

      // 2. Deve ter data de renovação
      if (!product.renewalDate) continue;

      const renewal = new Date(product.renewalDate);
      renewal.setHours(0, 0, 0, 0);

      // 3. Deve estar na janela (hoje ≤ renewal ≤ hoje + 45 dias)
      if (renewal < today || renewal > windowEnd) continue;

      // 4. Não deve ter oportunidade aberta para este produto/pessoa
      const key = `${product.personId}:${product.productTypeId}`;
      if (openOppSet.has(key)) continue;

      const daysUntil = Math.ceil(
        (renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      candidates.push({
        personProductId: product.personProductId,
        personId: product.personId,
        personName: product.personName,
        productTypeId: product.productTypeId,
        productTypeName: product.productTypeName,
        renewalDate: renewal,
        daysUntilRenewal: daysUntil,
        ownerId: product.ownerId,
      });
    }

    // Ordena por urgência (menos dias primeiro)
    return candidates.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
  }

  /**
   * Calcula a data ideal para o próximo passo da oportunidade de renovação.
   * Regra: renewal_date - 30 dias (para ter tempo de cotar e negociar).
   */
  static nextStepDueDate(renewalDate: Date): Date {
    const due = new Date(renewalDate);
    due.setDate(due.getDate() - 30);

    // Se a data já passou (renovação em menos de 30 dias), due = hoje + 1
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) {
      due.setDate(today.getDate() + 1);
    }

    return due;
  }
}
