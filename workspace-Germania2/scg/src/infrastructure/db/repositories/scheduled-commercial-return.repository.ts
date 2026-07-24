import { and, asc, eq, lte } from "drizzle-orm";
import type { ScheduledCommercialReturnRepository } from "@/application/ports";
import { ScheduledCommercialReturn } from "@/domain/entities/scheduled-commercial-return.entity";
import { db, type Database } from "../index";
import { scheduledCommercialReturns } from "../schema";
import {
  scheduledCommercialReturnToDb,
  scheduledCommercialReturnToDomain,
} from "../mappers";

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class DrizzleScheduledCommercialReturnRepository
  implements ScheduledCommercialReturnRepository
{
  constructor(private readonly database: Database = db) {}

  async findById(id: number): Promise<ScheduledCommercialReturn | null> {
    const rows = await this.database
      .select()
      .from(scheduledCommercialReturns)
      .where(eq(scheduledCommercialReturns.id, id))
      .limit(1);
    return rows[0] ? scheduledCommercialReturnToDomain(rows[0]) : null;
  }

  async findBySourceOpportunityId(
    sourceOpportunityId: number
  ): Promise<ScheduledCommercialReturn | null> {
    const rows = await this.database
      .select()
      .from(scheduledCommercialReturns)
      .where(
        eq(
          scheduledCommercialReturns.sourceOpportunityId,
          sourceOpportunityId
        )
      )
      .limit(1);
    return rows[0] ? scheduledCommercialReturnToDomain(rows[0]) : null;
  }

  async findDue(
    referenceDate: Date = new Date()
  ): Promise<ScheduledCommercialReturn[]> {
    const rows = await this.database
      .select()
      .from(scheduledCommercialReturns)
      .where(
        and(
          eq(scheduledCommercialReturns.status, "pendente"),
          lte(scheduledCommercialReturns.scheduledFor, dateString(referenceDate))
        )
      )
      .orderBy(asc(scheduledCommercialReturns.scheduledFor));
    return rows.map(scheduledCommercialReturnToDomain);
  }

  async create(
    commercialReturn: ScheduledCommercialReturn
  ): Promise<ScheduledCommercialReturn> {
    const [row] = await this.database
      .insert(scheduledCommercialReturns)
      .values(scheduledCommercialReturnToDb(commercialReturn))
      .returning();
    return scheduledCommercialReturnToDomain(row);
  }

  async update(
    commercialReturn: ScheduledCommercialReturn
  ): Promise<ScheduledCommercialReturn> {
    const data = scheduledCommercialReturnToDb(commercialReturn);
    const [row] = await this.database
      .update(scheduledCommercialReturns)
      .set({
        createdOpportunityId: data.createdOpportunityId,
        status: data.status,
        processedAt: data.processedAt,
        cancelledAt: data.cancelledAt,
      })
      .where(eq(scheduledCommercialReturns.id, commercialReturn.id))
      .returning();
    return scheduledCommercialReturnToDomain(row);
  }
}
