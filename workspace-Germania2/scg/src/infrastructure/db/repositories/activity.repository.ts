// ═══════════════════════════════════════════════════════════════════════════
// Repository: Activity (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, desc, lt, sql } from "drizzle-orm";
import { db, type Database } from "../index";
import { activities } from "../schema";
import { activityToDomain, activityToDb } from "../mappers";
import { Activity } from "@/domain/entities/activity.entity";
import type { ActivityRepository, PaginatedResult, PaginationParams } from "@/application/ports";

const DEFAULT_LIMIT = 20;

export class DrizzleActivityRepository implements ActivityRepository {
  constructor(private readonly database: Database = db) {}

  async findById(id: number): Promise<Activity | null> {
    const rows = await this.database
      .select()
      .from(activities)
      .where(eq(activities.id, id))
      .limit(1);

    return rows[0] ? activityToDomain(rows[0]) : null;
  }

  async findByPersonId(
    personId: number,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Activity>> {
    const limit = pagination?.limit ?? DEFAULT_LIMIT;
    const cursor = pagination?.cursor ?? null;

    const conditions = [eq(activities.personId, personId)];

    if (cursor) {
      conditions.push(lt(activities.id, cursor));
    }

    const rows = await this.database
      .select()
      .from(activities)
      .where(and(...conditions))
      .orderBy(desc(activities.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(activityToDomain);
    const lastItem = data[data.length - 1];

    const [countResult] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(activities)
      .where(eq(activities.personId, personId));

    return {
      data,
      total: countResult?.count ?? 0,
      cursor: hasMore && lastItem ? lastItem.id : null,
      hasMore,
    };
  }

  async create(activity: Activity): Promise<Activity> {
    const data = activityToDb(activity);

    const [row] = await this.database
      .insert(activities)
      .values({
        personId: data.personId!,
        leadId: data.leadId,
        opportunityId: data.opportunityId,
        ownerId: data.ownerId,
        type: data.type as any,
        description: data.description,
      })
      .returning();

    return activityToDomain(row);
  }
}
