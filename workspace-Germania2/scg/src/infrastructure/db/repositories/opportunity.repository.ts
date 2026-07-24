// ═══════════════════════════════════════════════════════════════════════════
// Repository: Opportunity (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, desc, lt, sql } from "drizzle-orm";
import { db, type Database } from "../index";
import { opportunities } from "../schema";
import { opportunityToDomain, opportunityToDb } from "../mappers";
import { Opportunity } from "@/domain/entities/opportunity.entity";
import type { OpportunityRepository, PaginatedResult, PaginationParams } from "@/application/ports";

const DEFAULT_LIMIT = 50;

export class DrizzleOpportunityRepository implements OpportunityRepository {
  constructor(private readonly database: Database = db) {}

  async findById(id: number): Promise<Opportunity | null> {
    const rows = await this.database
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, id))
      .limit(1);

    return rows[0] ? opportunityToDomain(rows[0]) : null;
  }

  async findByPersonId(personId: number): Promise<Opportunity[]> {
    const rows = await this.database
      .select()
      .from(opportunities)
      .where(eq(opportunities.personId, personId))
      .orderBy(desc(opportunities.createdAt));

    return rows.map(opportunityToDomain);
  }

  async findByLeadId(leadId: number): Promise<Opportunity | null> {
    const rows = await this.database
      .select()
      .from(opportunities)
      .where(eq(opportunities.leadId, leadId))
      .limit(1);
    return rows[0] ? opportunityToDomain(rows[0]) : null;
  }

  async findByRenewalKey(renewalKey: string): Promise<Opportunity | null> {
    const rows = await this.database
      .select()
      .from(opportunities)
      .where(eq(opportunities.renewalKey, renewalKey))
      .limit(1);
    return rows[0] ? opportunityToDomain(rows[0]) : null;
  }

  async findByRecoveryKey(recoveryKey: string): Promise<Opportunity | null> {
    const rows = await this.database
      .select()
      .from(opportunities)
      .where(eq(opportunities.recoveryKey, recoveryKey))
      .limit(1);
    return rows[0] ? opportunityToDomain(rows[0]) : null;
  }

  async listRenewals(): Promise<Opportunity[]> {
    const rows = await this.database
      .select()
      .from(opportunities)
      .where(eq(opportunities.type, "renovacao"))
      .orderBy(desc(opportunities.createdAt));
    return rows.map(opportunityToDomain);
  }

  async findOpenByPersonAndProduct(
    personId: number,
    productTypeId: number
  ): Promise<Opportunity | null> {
    const rows = await this.database
      .select()
      .from(opportunities)
      .where(
        and(
          eq(opportunities.personId, personId),
          eq(opportunities.productTypeId, productTypeId),
          eq(opportunities.status, "aberta")
        )
      )
      .limit(1);

    return rows[0] ? opportunityToDomain(rows[0]) : null;
  }

  async listByPipeline(pipelineId: number): Promise<Opportunity[]> {
    const rows = await this.database
      .select()
      .from(opportunities)
      .where(
        and(
          eq(opportunities.pipelineId, pipelineId),
          eq(opportunities.status, "aberta")
        )
      )
      .orderBy(desc(opportunities.lastMovementAt));

    return rows.map(opportunityToDomain);
  }

  async listOpen(params?: PaginationParams): Promise<PaginatedResult<Opportunity>> {
    const limit = params?.limit ?? DEFAULT_LIMIT;
    const cursor = params?.cursor ?? null;

    const conditions = [eq(opportunities.status, "aberta" as const)];

    if (cursor) {
      conditions.push(lt(opportunities.id, cursor));
    }

    const rows = await this.database
      .select()
      .from(opportunities)
      .where(and(...conditions))
      .orderBy(desc(opportunities.lastMovementAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(opportunityToDomain);
    const lastItem = data[data.length - 1];

    const [countResult] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(eq(opportunities.status, "aberta"));

    return {
      data,
      total: countResult?.count ?? 0,
      cursor: hasMore && lastItem ? lastItem.id : null,
      hasMore,
    };
  }

  async create(opportunity: Opportunity): Promise<Opportunity> {
    const data = opportunityToDb(opportunity);

    const [row] = await this.database
      .insert(opportunities)
      .values({
        personId: data.personId!,
        leadId: data.leadId,
        personProductId: data.personProductId,
        crossSellSuggestionId: data.crossSellSuggestionId,
        productTypeId: data.productTypeId!,
        pipelineId: data.pipelineId!,
        stageId: data.stageId!,
        ownerId: data.ownerId!,
        createdById: data.createdById,
        type: data.type!,
        estimatedValue: data.estimatedValue,
        probability: data.probability!,
        source: data.source!,
        channel: data.channel!,
        campaign: data.campaign,
        referredByPersonId: data.referredByPersonId,
        sourceDetail: data.sourceDetail,
        renewalKey: data.renewalKey,
        recoveryKey: data.recoveryKey,
        status: data.status as any,
        closeOutcome: data.closeOutcome,
        lossReason: data.lossReason,
        closeNotes: data.closeNotes,
        nextExpirationDate: data.nextExpirationDate,
        notes: data.notes,
      })
      .returning();

    return opportunityToDomain(row);
  }

  async update(opportunity: Opportunity): Promise<Opportunity> {
    const data = opportunityToDb(opportunity);

    const [row] = await this.database
      .update(opportunities)
      .set({
        stageId: data.stageId,
        ownerId: data.ownerId,
        estimatedValue: data.estimatedValue,
        probability: data.probability,
        status: data.status as any,
        closeOutcome: data.closeOutcome,
        lossReason: data.lossReason,
        closeNotes: data.closeNotes,
        nextExpirationDate: data.nextExpirationDate,
        notes: data.notes,
        lastMovementAt: data.lastMovementAt,
        closedAt: data.closedAt,
      })
      .where(eq(opportunities.id, opportunity.id))
      .returning();

    return opportunityToDomain(row);
  }

  async countOpenByOwner(ownerId: number): Promise<number> {
    const [result] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.ownerId, ownerId),
          eq(opportunities.status, "aberta")
        )
      );

    return result?.count ?? 0;
  }
}
