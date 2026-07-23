// ═══════════════════════════════════════════════════════════════════════════
// Domain Service: CrossSellEngine
// Identifica oportunidades de cross selling com base nos produtos da pessoa
// INV-08: Quando produto ativo é adicionado → verificar matriz de cross-sell
// ═══════════════════════════════════════════════════════════════════════════

import { ProductStatus } from "../types";

/** Regra de cross-sell: se tem X, sugerir Y */
export interface CrossSellRule {
  /** ID do produto que a pessoa JÁ tem */
  sourceProductTypeId: number;
  /** IDs dos produtos sugeridos */
  suggestedProductTypeIds: number[];
  /** Razão textual para a sugestão */
  reason: string;
}

/** Produto atual da pessoa (dados mínimos para avaliação) */
export interface PersonProductSnapshot {
  productTypeId: number;
  status: ProductStatus;
}

/** Sugestão gerada pelo engine */
export interface CrossSellSuggestionOutput {
  personId: number;
  productTypeId: number;
  reason: string;
}

export class CrossSellEngine {
  private readonly rules: CrossSellRule[];

  constructor(rules: CrossSellRule[]) {
    this.rules = rules;
  }

  /**
   * Matriz padrão de cross-sell para seguros.
   * Pode ser sobrescrita via configuração no banco (product_types.cross_sell_rules).
   */
  static defaultRules(): CrossSellRule[] {
    // IDs são exemplos — devem ser configurados conforme product_types do banco
    return [
      {
        sourceProductTypeId: 1, // Auto
        suggestedProductTypeIds: [2, 3], // Residencial, Vida
        reason: "Cliente com seguro Auto pode se interessar por proteção residencial e de vida.",
      },
      {
        sourceProductTypeId: 2, // Residencial
        suggestedProductTypeIds: [1, 4], // Auto, Empresarial
        reason: "Cliente com seguro Residencial pode precisar de Auto ou Empresarial.",
      },
      {
        sourceProductTypeId: 3, // Vida
        suggestedProductTypeIds: [1, 5], // Auto, Condomínio
        reason: "Cliente com seguro Vida demonstra preocupação com proteção patrimonial.",
      },
      {
        sourceProductTypeId: 4, // Empresarial
        suggestedProductTypeIds: [6, 3], // Equipamentos, Vida
        reason: "Cliente empresarial pode precisar de seguro de equipamentos e vida para sócios.",
      },
      {
        sourceProductTypeId: 5, // Condomínio
        suggestedProductTypeIds: [2, 4], // Residencial, Empresarial
        reason: "Síndico ou morador de condomínio pode ter interesse em outros produtos.",
      },
    ];
  }

  /**
   * Avalia quais produtos sugerir para uma pessoa, dado seu portfólio atual.
   * Retorna apenas sugestões para produtos que a pessoa AINDA NÃO possui.
   */
  evaluate(
    personId: number,
    currentProducts: PersonProductSnapshot[],
    existingSuggestedProductTypeIds: number[] = []
  ): CrossSellSuggestionOutput[] {
    // Produtos ativos da pessoa
    const activeProductTypeIds = new Set(
      currentProducts
        .filter((p) => p.status === ProductStatus.ATIVA)
        .map((p) => p.productTypeId)
    );

    // Produtos já sugeridos (para não duplicar)
    const alreadySuggested = new Set(existingSuggestedProductTypeIds);

    const suggestions: CrossSellSuggestionOutput[] = [];

    for (const rule of this.rules) {
      // Se a pessoa tem o produto fonte (ativo)
      if (!activeProductTypeIds.has(rule.sourceProductTypeId)) continue;

      // Para cada produto sugerido pela regra
      for (const suggestedId of rule.suggestedProductTypeIds) {
        // Se a pessoa JÁ tem esse produto → não sugerir
        if (activeProductTypeIds.has(suggestedId)) continue;

        // Se já foi sugerido antes → não duplicar
        if (alreadySuggested.has(suggestedId)) continue;

        suggestions.push({
          personId,
          productTypeId: suggestedId,
          reason: rule.reason,
        });
      }
    }

    // Deduplica por productTypeId (pode ter múltiplas regras sugerindo o mesmo)
    const seen = new Set<number>();
    return suggestions.filter((s) => {
      if (seen.has(s.productTypeId)) return false;
      seen.add(s.productTypeId);
      return true;
    });
  }

  /**
   * Avalia para um único produto recém-ativado (uso mais comum no event handler).
   */
  evaluateForNewProduct(
    personId: number,
    newProductTypeId: number,
    currentProducts: PersonProductSnapshot[],
    existingSuggestedProductTypeIds: number[] = []
  ): CrossSellSuggestionOutput[] {
    // Filtra apenas regras que partem do novo produto
    const relevantRules = this.rules.filter(
      (r) => r.sourceProductTypeId === newProductTypeId
    );

    const engine = new CrossSellEngine(relevantRules);
    return engine.evaluate(personId, currentProducts, existingSuggestedProductTypeIds);
  }
}
