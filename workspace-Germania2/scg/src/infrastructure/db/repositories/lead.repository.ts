import { and, desc, eq, inArray } from "drizzle-orm";
import type { LeadRepository } from "@/application/ports";
import { Lead } from "@/domain/entities/lead.entity";
import { db, type Database } from "../index";
import { leadToDb, leadToDomain } from "../mappers";
import { leads } from "../schema";

export class DrizzleLeadRepository implements LeadRepository {
  constructor(private readonly database: Database = db) {}

  async findById(id: number): Promise<Lead | null> {
    const rows = await this.database
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);
    return rows[0] ? leadToDomain(rows[0]) : null;
  }

  async findByOpportunityId(opportunityId: number): Promise<Lead | null> {
    const rows = await this.database
      .select()
      .from(leads)
      .where(eq(leads.opportunityId, opportunityId))
      .limit(1);
    return rows[0] ? leadToDomain(rows[0]) : null;
  }

  async findOpenByPersonId(personId: number): Promise<Lead[]> {
    const rows = await this.database
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.personId, personId),
          inArray(leads.status, ["novo", "em_qualificacao"])
        )
      )
      .orderBy(desc(leads.createdAt));
    return rows.map(leadToDomain);
  }

  async create(lead: Lead): Promise<Lead> {
    const data = leadToDb(lead);
    const [row] = await this.database
      .insert(leads)
      .values(data)
      .returning();
    return leadToDomain(row);
  }

  async update(lead: Lead): Promise<Lead> {
    const data = leadToDb(lead);
    const [row] = await this.database
      .update(leads)
      .set(data)
      .where(eq(leads.id, lead.id))
      .returning();
    return leadToDomain(row);
  }
}
