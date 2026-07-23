// ═══════════════════════════════════════════════════════════════════════════
// Repository: CustomerSuccess (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, asc } from "drizzle-orm";
import { db } from "../index";
import { customerSuccessStages } from "../schema";
import { csStageToDomain, csStageToDb } from "../mappers";
import { CustomerSuccessStage } from "@/domain/entities/customer-success-stage.entity";
import type { CustomerSuccessRepository } from "@/application/ports";

export class DrizzleCustomerSuccessRepository implements CustomerSuccessRepository {
  async findByPersonId(personId: number): Promise<CustomerSuccessStage[]> {
    const rows = await db
      .select()
      .from(customerSuccessStages)
      .where(eq(customerSuccessStages.personId, personId))
      .orderBy(asc(customerSuccessStages.dueDate));

    return rows.map(csStageToDomain);
  }

  async findByOpportunityId(opportunityId: number): Promise<CustomerSuccessStage[]> {
    const rows = await db
      .select()
      .from(customerSuccessStages)
      .where(eq(customerSuccessStages.opportunityId, opportunityId))
      .orderBy(asc(customerSuccessStages.dueDate));

    return rows.map(csStageToDomain);
  }

  async findPending(): Promise<CustomerSuccessStage[]> {
    const rows = await db
      .select()
      .from(customerSuccessStages)
      .where(eq(customerSuccessStages.status, "pendente"))
      .orderBy(asc(customerSuccessStages.dueDate));

    return rows.map(csStageToDomain);
  }

  async create(stage: CustomerSuccessStage): Promise<CustomerSuccessStage> {
    const data = csStageToDb(stage);

    const [row] = await db
      .insert(customerSuccessStages)
      .values({
        personId: data.personId!,
        opportunityId: data.opportunityId!,
        ownerId: data.ownerId,
        stage: data.stage as any,
        status: data.status as any,
        dueDate: data.dueDate,
        notes: data.notes,
      })
      .returning();

    return csStageToDomain(row);
  }

  async createMany(stages: CustomerSuccessStage[]): Promise<CustomerSuccessStage[]> {
    if (stages.length === 0) return [];

    const values = stages.map((s) => {
      const data = csStageToDb(s);
      return {
        personId: data.personId!,
        opportunityId: data.opportunityId!,
        ownerId: data.ownerId,
        stage: data.stage as any,
        status: data.status as any,
        dueDate: data.dueDate,
        notes: data.notes,
      };
    });

    const rows = await db
      .insert(customerSuccessStages)
      .values(values)
      .returning();

    return rows.map(csStageToDomain);
  }

  async update(stage: CustomerSuccessStage): Promise<CustomerSuccessStage> {
    const data = csStageToDb(stage);

    const [row] = await db
      .update(customerSuccessStages)
      .set({
        status: data.status as any,
        completedAt: data.completedAt,
        notes: data.notes,
        dueDate: data.dueDate,
      })
      .where(eq(customerSuccessStages.id, stage.id))
      .returning();

    return csStageToDomain(row);
  }
}
