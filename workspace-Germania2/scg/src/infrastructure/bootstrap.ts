// ═══════════════════════════════════════════════════════════════════════════
// SCG — Application Bootstrap
// Inicializa event handlers e retorna instância pronta para uso.
// Chamar UMA VEZ no startup (ex: instrumentation.ts do Next.js).
// ═══════════════════════════════════════════════════════════════════════════

import { registerEventHandlers } from "./events/handlers/register-handlers";
import { getRepositories } from "./db/repositories";

let _bootstrapped = false;

/**
 * Inicializa a aplicação:
 * 1. Cria repositórios (singleton)
 * 2. Registra event handlers no Event Bus
 *
 * Idempotente — pode ser chamado múltiplas vezes com segurança.
 */
export function bootstrap(): void {
  if (_bootstrapped) return;

  const repos = getRepositories();

  // Registra handlers de eventos de domínio
  registerEventHandlers({
    customerSuccessRepo: repos.customerSuccess,
    personRepo: repos.person,
    personProductRepo: repos.personProduct,
    crossSellRepo: repos.crossSell,
    timelineRepo: repos.timeline,
  });

  _bootstrapped = true;
  console.log("[SCG] Bootstrap concluído. Sistema pronto.");
}
