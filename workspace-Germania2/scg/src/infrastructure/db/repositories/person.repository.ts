// ═══════════════════════════════════════════════════════════════════════════
// Repository: Person (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, or, ilike, desc, lt, sql } from "drizzle-orm";
import { db } from "../index";
import { people } from "../schema";
import { personToDomain, personToDb } from "../mappers";
import { Person } from "@/domain/entities/person.entity";
import type { PersonRepository, PaginatedResult, PaginationParams } from "@/application/ports";

const DEFAULT_LIMIT = 20;

export class DrizzlePersonRepository implements PersonRepository {
  async findById(id: number): Promise<Person | null> {
    const rows = await db
      .select()
      .from(people)
      .where(eq(people.id, id))
      .limit(1);

    return rows[0] ? personToDomain(rows[0]) : null;
  }

  async findByDocument(document: string): Promise<Person | null> {
    const rows = await db
      .select()
      .from(people)
      .where(eq(people.document, document))
      .limit(1);

    return rows[0] ? personToDomain(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<Person | null> {
    const rows = await db
      .select()
      .from(people)
      .where(eq(people.email, email.toLowerCase()))
      .limit(1);

    return rows[0] ? personToDomain(rows[0]) : null;
  }

  async findByErpCustomerId(erpId: string): Promise<Person | null> {
    const rows = await db
      .select()
      .from(people)
      .where(eq(people.erpCustomerId, erpId))
      .limit(1);

    return rows[0] ? personToDomain(rows[0]) : null;
  }

  async list(params: {
    status?: string;
    ownerId?: number;
    search?: string;
    pagination?: PaginationParams;
  }): Promise<PaginatedResult<Person>> {
    const limit = params.pagination?.limit ?? DEFAULT_LIMIT;
    const cursor = params.pagination?.cursor ?? null;

    // Constrói condições WHERE
    const conditions = [];

    if (params.status) {
      conditions.push(eq(people.status, params.status as any));
    }

    if (params.ownerId) {
      conditions.push(eq(people.ownerId, params.ownerId));
    }

    if (params.search && params.search.trim().length > 0) {
      const term = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(people.name, term),
          ilike(people.email, term),
          ilike(people.document, term),
          ilike(people.phone, term)
        )!
      );
    }

    // Paginação por cursor (id < cursor para ordem DESC)
    if (cursor) {
      conditions.push(lt(people.id, cursor));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Busca dados + 1 extra para saber se tem mais
    const rows = await db
      .select()
      .from(people)
      .where(whereClause)
      .orderBy(desc(people.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(personToDomain);
    const lastItem = data[data.length - 1];

    // Total count (para exibição)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(people)
      .where(
        conditions.filter((c) => c !== undefined).length > 0
          ? and(...conditions.filter((c) => c !== undefined))
          : undefined
      );

    return {
      data,
      total: countResult?.count ?? 0,
      cursor: hasMore && lastItem ? lastItem.id : null,
      hasMore,
    };
  }

  async create(person: Person): Promise<Person> {
    const data = personToDb(person);

    const [row] = await db
      .insert(people)
      .values({
        name: data.name!,
        type: data.type as any,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        document: data.document,
        origin: data.origin,
        status: data.status as any,
        ownerId: data.ownerId,
        notes: data.notes,
        erpCustomerId: data.erpCustomerId,
      })
      .returning();

    return personToDomain(row);
  }

  async update(person: Person): Promise<Person> {
    const data = personToDb(person);

    const [row] = await db
      .update(people)
      .set({
        name: data.name,
        type: data.type as any,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        document: data.document,
        origin: data.origin,
        status: data.status as any,
        ownerId: data.ownerId,
        notes: data.notes,
        erpCustomerId: data.erpCustomerId,
        updatedAt: new Date(),
      })
      .where(eq(people.id, person.id))
      .returning();

    return personToDomain(row);
  }
}
