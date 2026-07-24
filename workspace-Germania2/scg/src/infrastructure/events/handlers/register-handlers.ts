// ═══════════════════════════════════════════════════════════════════════════
// Handler Registration
// Registra todos os event handlers no Event Bus.
// Chamado uma vez no bootstrap da aplicação.
// ═══════════════════════════════════════════════════════════════════════════

import { eventBus } from "../event-bus";
import { OnOpportunityWonHandler } from "./on-opportunity-won";
import { OnProductActivatedHandler } from "./on-product-activated";
import type {
  CustomerSuccessRepository,
  PersonRepository,
  PersonProductRepository,
  CrossSellRepository,
  TimelineRepository,
} from "@/application/ports";

export interface HandlerDependencies {
  customerSuccessRepo: CustomerSuccessRepository;
  personRepo: PersonRepository;
  personProductRepo: PersonProductRepository;
  crossSellRepo: CrossSellRepository;
  timelineRepo: TimelineRepository;
}

/**
 * Registra todos os handlers de eventos.
 * Deve ser chamado no bootstrap da aplicação (ex: em instrumentation.ts do Next.js
 * ou em um módulo de inicialização).
 */
export function registerEventHandlers(deps: HandlerDependencies): void {
  // ─── Opportunity Won → Customer Success ──────────────────────────────────
  const onOpportunityWon = new OnOpportunityWonHandler(
    deps.customerSuccessRepo,
    deps.timelineRepo
  );
  eventBus.on("opportunity.won", (event) => onOpportunityWon.handle(event));

  // ─── Product Activated → Cross Sell ──────────────────────────────────────
  const onProductActivated = new OnProductActivatedHandler(
    deps.personProductRepo,
    deps.crossSellRepo,
    deps.timelineRepo
  );
  eventBus.on("product.activated", (event) => onProductActivated.handle(event));

  console.log("[EventHandlers] Todos os handlers registrados com sucesso.");
}
