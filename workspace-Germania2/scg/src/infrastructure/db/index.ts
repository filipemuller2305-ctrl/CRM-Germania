// ═══════════════════════════════════════════════════════════════════════════
// SCG — Database Connection (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

// ─── TRANSACTION HELPER ──────────────────────────────────────────────────────

/**
 * Executa uma função dentro de uma transação.
 * Se a função lançar erro, faz rollback automático.
 */
export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(fn);
}
