// ═══════════════════════════════════════════════════════════════════════════
// Repository: NextStep (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, lt, sql } from "drizzle-orm";
import { db } from "../index";
import { nextSteps } from "../schema";
import { nextStepToDomain, nextStepToDb } from "../mappers";
import { NextStep } from "@/domain/entities/next-step.entity";
import type { NextStepRepository } from "@/application/ports";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export class DrizzleNextStepRepository implements NextStepRepository {
  async findById(id: number): Promise<NextStep | null> {
    const rows = await db
      .select()
      .from(nextSteps)
      .where(eq(nextSteps.id, id))
      .limit(1);

    return rows[0] ? nextStepToDomain(rows[0]) : null;
  }

  async findPendingByOpportunity(opportunityId: number): Promise<NextStep[]> {
    const rows = await db
      .select()
      .from(nextSteps)
      .where(
        and(
          eq(nextSteps.opportunityId, opportunityId),
          eq(nextSteps.status, "pendente")
        )
      );

    return rows.map(nextStepToDomain);
  }

  async findPendingByOwner(ownerId: number): Promise<NextStep[]> {
    const rows = await db
      .select()
      .from(nextSteps)
      .where(
        and(
          eq(nextSteps.ownerId, ownerId),
          eq(nextSteps.status, "pendente")
        )
      );

    return rows.map(nextStepToDomain);
  }

  async findOverdue(): Promise<NextStep[]> {
    const today = todayISO();

    const rows = await db
      .select()
      .from(nextSteps)
      .where(
        and(
          eq(nextSteps.status, "pendente"),
          lt(nextSteps.dueDate, today)
        )
      );

    return rows.map(nextStepToDomain);
  }

  async findDueToday(ownerId?: number): Promise<NextStep[]> {
    const today = todayISO();

    const conditions = [
      eq(nextSteps.status, "pendente"),
      eq(nextSteps.dueDate, today),
    ];

    if (ownerId) {
      conditions.push(eq(nextSteps.ownerId, ownerId));
    }

    const rows = await db
      .select()
      .from(nextSteps)
      .where(and(...conditions));

    return rows.map(nextStepToDomain);
  }

  async create(nextStep: NextStep): Promise<NextStep> {
    const data = nextStepToDb(nextStep);

    const [row] = await db
      .insert(nextSteps)
      .values({
        opportunityId: data.opportunityId!,
        ownerId: data.ownerId,
        description: data.description!,
        dueDate: data.dueDate!,
        dueTime: data.dueTime,
        objective: data.objective,
        status: data.status as any,
      })
      .returning();

    return nextStepToDomain(row);
  }

  async update(nextStep: NextStep): Promise<NextStep> {
    const data = nextStepToDb(nextStep);

    const [row] = await db
      .update(nextSteps)
      .set({
        description: data.description,
        dueDate: data.dueDate,
        dueTime: data.dueTime,
        objective: data.objective,
        status: data.status as any,
        completedAt: data.completedAt,
      })
      .where(eq(nextSteps.id, nextStep.id))
      .returning();

    return nextStepToDomain(row);
  }
}
