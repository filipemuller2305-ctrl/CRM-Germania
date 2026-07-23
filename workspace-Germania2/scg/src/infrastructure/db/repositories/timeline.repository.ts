// ═══════════════════════════════════════════════════════════════════════════
// Repository: Timeline (Drizzle + PostgreSQL)
// INV-03: INSERT ONLY — nunca UPDATE ou DELETE
// ═══════════════════════════════════════════════════════════════════════════

import { eq, desc, lt, sql } from "drizzle-orm";
import { db, type Database } from "../index";
import { timelineEvents } from "../schema";
import type { TimelineRepository, TimelineEventInput, PaginatedResult, PaginationParams } from "@/application/ports";

const DEFAULT_LIMIT = 30;

export class DrizzleTimelineRepository implements TimelineRepository {
  constructor(private readonly database: Database = db) {}

  /**
   * Adiciona um evento à timeline.
   * ⚠️ Esta é a ÚNICA operação de escrita permitida (INSERT ONLY).
   * A tabela tem REVOKE UPDATE, DELETE no PostgreSQL como proteção extra.
   */
  async add(event: TimelineEventInput): Promise<void> {
    await this.database.insert(timelineEvents).values({
      personId: event.personId,
      leadId: event.leadId ?? null,
      opportunityId: event.opportunityId ?? null,
      actorId: event.actorId ?? null,
      type: event.type,
      title: event.title,
      description: event.description ?? null,
      metadata: event.metadata ?? null,
    });
  }

  /**
   * Busca eventos da timeline de uma pessoa (ordem cronológica reversa).
   * Paginação por cursor para infinite scroll.
   */
  async findByPersonId(
    personId: number,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<any>> {
    const limit = pagination?.limit ?? DEFAULT_LIMIT;
    const cursor = pagination?.cursor ?? null;

    const conditions = [eq(timelineEvents.personId, personId)];

    if (cursor) {
      conditions.push(lt(timelineEvents.id, cursor));
    }

    const rows = await this.database
      .select({
        id: timelineEvents.id,
        personId: timelineEvents.personId,
        opportunityId: timelineEvents.opportunityId,
        actorId: timelineEvents.actorId,
        type: timelineEvents.type,
        title: timelineEvents.title,
        description: timelineEvents.description,
        metadata: timelineEvents.metadata,
        createdAt: timelineEvents.createdAt,
      })
      .from(timelineEvents)
      .where(sql`${timelineEvents.personId} = ${personId}${cursor ? sql` AND ${timelineEvents.id} < ${cursor}` : sql``}`)
      .orderBy(desc(timelineEvents.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const lastItem = data[data.length - 1];

    const [countResult] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(timelineEvents)
      .where(eq(timelineEvents.personId, personId));

    return {
      data,
      total: countResult?.count ?? 0,
      cursor: hasMore && lastItem ? lastItem.id : null,
      hasMore,
    };
  }
}
