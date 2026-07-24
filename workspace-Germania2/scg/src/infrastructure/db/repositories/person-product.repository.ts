// ═══════════════════════════════════════════════════════════════════════════
// Repository: PersonProduct (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../index";
import { personProducts } from "../schema";
import { personProductToDomain, personProductToDb } from "../mappers";
import { PersonProduct } from "@/domain/entities/person-product.entity";
import type { PersonProductRepository } from "@/application/ports";

export class DrizzlePersonProductRepository implements PersonProductRepository {
  async findById(id: number): Promise<PersonProduct | null> {
    const rows = await db
      .select()
      .from(personProducts)
      .where(eq(personProducts.id, id))
      .limit(1);

    return rows[0] ? personProductToDomain(rows[0]) : null;
  }

  async findByPersonId(personId: number): Promise<PersonProduct[]> {
    const rows = await db
      .select()
      .from(personProducts)
      .where(eq(personProducts.personId, personId));

    return rows.map(personProductToDomain);
  }

  async findActiveByPersonId(personId: number): Promise<PersonProduct[]> {
    const rows = await db
      .select()
      .from(personProducts)
      .where(
        and(
          eq(personProducts.personId, personId),
          eq(personProducts.status, "ativa")
        )
      );

    return rows.map(personProductToDomain);
  }

  /**
   * Inclui ciclos vencidos recentemente para recuperar uma execução de cron
   * perdida sem abandonar a idempotência por renewalKey.
   * Usado pelo RenewalCheckerCron.
   */
  async findRenewable(
    windowDays: number,
    overdueLookbackDays = 90
  ): Promise<PersonProduct[]> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - overdueLookbackDays);
    const startStr = windowStart.toISOString().split("T")[0];

    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + windowDays);
    const endStr = windowEnd.toISOString().split("T")[0];

    const rows = await db
      .select()
      .from(personProducts)
      .where(
        and(
          eq(personProducts.status, "ativa"),
          gte(personProducts.renewalDate, startStr),
          lte(personProducts.renewalDate, endStr)
        )
      );

    return rows.map(personProductToDomain);
  }

  async create(product: PersonProduct): Promise<PersonProduct> {
    const data = personProductToDb(product);

    const [row] = await db
      .insert(personProducts)
      .values({
        personId: data.personId!,
        productTypeId: data.productTypeId!,
        policyNumber: data.policyNumber,
        insurer: data.insurer,
        status: data.status as any,
        startDate: data.startDate,
        renewalDate: data.renewalDate,
        premiumValue: data.premiumValue,
        erpPolicyId: data.erpPolicyId,
        source: data.source as any,
      })
      .returning();

    return personProductToDomain(row);
  }

  async update(product: PersonProduct): Promise<PersonProduct> {
    const data = personProductToDb(product);

    const [row] = await db
      .update(personProducts)
      .set({
        policyNumber: data.policyNumber,
        insurer: data.insurer,
        status: data.status as any,
        startDate: data.startDate,
        renewalDate: data.renewalDate,
        premiumValue: data.premiumValue,
        erpPolicyId: data.erpPolicyId,
        updatedAt: new Date(),
      })
      .where(eq(personProducts.id, product.id))
      .returning();

    return personProductToDomain(row);
  }
}
