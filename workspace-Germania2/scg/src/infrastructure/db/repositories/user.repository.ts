// ═══════════════════════════════════════════════════════════════════════════
// Repository: User (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { eq, asc } from "drizzle-orm";
import { db } from "../index";
import { users } from "../schema";
import type { UserRepository, UserData } from "@/application/ports";

export class DrizzleUserRepository implements UserRepository {
  async findById(id: number): Promise<UserData | null> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!rows[0]) return null;

    return {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role,
      isActive: rows[0].isActive,
    };
  }

  async findByEmail(email: string): Promise<UserData | null> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!rows[0]) return null;

    return {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role,
      isActive: rows[0].isActive,
    };
  }

  async list(): Promise<UserData[]> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      isActive: r.isActive,
    }));
  }
}
