// ═══════════════════════════════════════════════════════════════════════════
// Server Actions — Helpers compartilhados
// ═══════════════════════════════════════════════════════════════════════════

import { bootstrap } from "@/infrastructure/bootstrap";
import { getUseCases } from "@/application/use-cases-factory";
import { getRepositories } from "@/infrastructure/db/repositories";

// Garante que o bootstrap rodou (idempotente)
bootstrap();

// ─── AUTH HELPER ─────────────────────────────────────────────────────────────
// NOTA: Substituir pela implementação real do NextAuth quando integrado.
// Por enquanto, simula a sessão. Em produção:
//
//   import { auth } from "@/infrastructure/auth";
//   const session = await auth();
//   return session?.user?.id ?? null;

export async function getCurrentUserId(): Promise<number | null> {
  // TODO: Integrar com NextAuth v5
  // const session = await auth();
  // if (!session?.user?.id) throw new Error("Não autenticado");
  // return Number(session.user.id);

  // Stub temporário para desenvolvimento:
  return 1;
}

/** Exige autenticação — lança erro se não logado */
export async function requireAuth(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Acesso negado. Faça login para continuar.");
  }
  return userId;
}

// ─── EXPORTS CONVENIENTES ────────────────────────────────────────────────────

export { getUseCases, getRepositories };

// ─── RESPONSE TYPES ──────────────────────────────────────────────────────────

export interface ActionResponse<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export function ok<T>(data: T): ActionResponse<T> {
  return { success: true, data };
}

export function fail(error: string, errorCode?: string): ActionResponse<never> {
  return { success: false, error, errorCode };
}
