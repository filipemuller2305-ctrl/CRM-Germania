// ═══════════════════════════════════════════════════════════════════════════
// Event Handler: On Product Activated
// INV-08: Quando produto é ativado → engine de Cross Selling avalia sugestões
// ═══════════════════════════════════════════════════════════════════════════

import type { ProductActivatedEvent, CrossSellDetectedEvent } from "@/domain/events";
import { CrossSellEngine } from "@/domain/services/cross-sell-engine";
import { eventBus } from "@/infrastructure/events/event-bus";
import type {
  PersonProductRepository,
  CrossSellRepository,
  TimelineRepository,
} from "@/application/ports";

export class OnProductActivatedHandler {
  private readonly engine: CrossSellEngine;

  constructor(
    private personProductRepo: PersonProductRepository,
    private crossSellRepo: CrossSellRepository,
    private timelineRepo: TimelineRepository,
    crossSellRules?: Parameters<typeof CrossSellEngine.defaultRules> extends [] ? any : any
  ) {
    // Usa regras customizadas ou padrão
    this.engine = new CrossSellEngine(
      crossSellRules ?? CrossSellEngine.defaultRules()
    );
  }

  async handle(event: ProductActivatedEvent): Promise<void> {
    const { personId, productTypeId, productTypeName } = event;

    // 1. Busca produtos atuais da pessoa
    const currentProducts = await this.personProductRepo.findActiveByPersonId(personId);
    const snapshots = currentProducts.map((p) => ({
      productTypeId: p.productTypeId,
      status: p.status,
    }));

    // 2. Busca sugestões já existentes (para não duplicar)
    const existingSuggestedIds = await this.crossSellRepo.findSuggestedProductTypeIds(personId);

    // 3. Avalia cross sell apenas para o novo produto
    const suggestions = this.engine.evaluateForNewProduct(
      personId,
      productTypeId,
      snapshots,
      existingSuggestedIds
    );

    if (suggestions.length === 0) {
      return; // nenhuma sugestão nova
    }

    // 4. Persiste sugestões e emite eventos
    for (const suggestion of suggestions) {
      const saved = await this.crossSellRepo.create({
        personId: suggestion.personId,
        productTypeId: suggestion.productTypeId,
        reason: suggestion.reason,
        status: "sugerida",
      });

      // Timeline
      await this.timelineRepo.add({
        personId,
        actorId: null, // sistema
        type: "cross_sell",
        title: "Oportunidade de Cross Selling identificada",
        description: suggestion.reason,
        metadata: {
          sourceProduct: productTypeName,
          suggestedProductTypeId: suggestion.productTypeId,
        },
      });

      // Evento
      await eventBus.emit(
        new (await import("@/domain/events")).CrossSellDetectedEvent(
          saved.id,
          personId,
          suggestion.productTypeId,
          suggestion.reason
        )
      );
    }

    console.log(
      `[OnProductActivated] ${suggestions.length} sugestão(ões) de cross sell ` +
      `gerada(s) para pessoa ${personId} após ativar produto ${productTypeName}.`
    );
  }
}
