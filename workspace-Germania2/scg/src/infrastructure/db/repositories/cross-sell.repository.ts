// ═══════════════════════════════════════════════════════════════════════════
// Repository: CrossSell (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, desc } from "drizzle-orm";
import { db } from "../index";
import { crossSellSuggestions } from "../schema";
import type { CrossSellRepository, CrossSellSuggestionData } from "@/application/ports";

export class DrizzleCrossSellRepository implements CrossSellRepository {
  async findByPersonId(personId: number): Promise<CrossSellSuggestionData[]> {
    const rows = await db
      .select()
      .from(crossSellSuggestions)
      .where(eq(crossSellSuggestions.personId, personId))
      .orderBy(desc(crossSellSuggestions.createdAt));

    return rows.map((r) => ({
      personId: r.personId,
      productTypeId: r.productTypeId,
      reason: r.reason ?? "",
      status: r.status,
      opportunityId: r.opportunityId,
    }));
  }

  async findSuggested(): Promise<CrossSellSuggestionData[]> {
    const rows = await db
      .select()
      .from(crossSellSuggestions)
      .where(eq(crossSellSuggestions.status, "sugerida"))
      .orderBy(desc(crossSellSuggestions.createdAt));

    return rows.map((r) => ({
      personId: r.personId,
      productTypeId: r.productTypeId,
      reason: r.reason ?? "",
      status: r.status,
      opportunityId: r.opportunityId,
    }));
  }

  /**
   * Retorna os productTypeIds já sugeridos (status != descartada) para uma pessoa.
   * Usado para evitar sugestões duplicadas.
   */
  async findSuggestedProductTypeIds(personId: number): Promise<number[]> {
    const rows = await db
      .select({ productTypeId: crossSellSuggestions.productTypeId })
      .from(crossSellSuggestions)
      .where(
        and(
          eq(crossSellSuggestions.personId, personId),
          eq(crossSellSuggestions.status, "sugerida")
        )
      );

    return rows.map((r) => r.productTypeId);
  }

  async create(data: CrossSellSuggestionData): Promise<{ id: number }> {
    const [row] = await db
      .insert(crossSellSuggestions)
      .values({
        personId: data.personId,
        productTypeId: data.productTypeId,
        reason: data.reason,
        status: data.status as any,
        opportunityId: data.opportunityId ?? null,
      })
      .returning({ id: crossSellSuggestions.id });

    return { id: row.id };
  }

  async updateStatus(
    id: number,
    status: string,
    opportunityId?: number
  ): Promise<void> {
    await db
      .update(crossSellSuggestions)
      .set({
        status: status as any,
        opportunityId: opportunityId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(crossSellSuggestions.id, id));
  }
}
