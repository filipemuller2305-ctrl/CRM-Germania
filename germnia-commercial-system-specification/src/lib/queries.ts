import { db } from "@/db";
import {
  people,
  users,
  opportunities,
  pipelines,
  pipelineStages,
  nextSteps,
  activities,
  timelineEvents,
  productTypes,
  personProducts,
  crossSellSuggestions,
  customerSuccessStages,
  documents,
  erpSyncLog,
} from "@/db/schema";
import { and, desc, asc, eq, inArray, sql, lt, lte, gte, isNull, ne } from "drizzle-orm";
import { todayISO } from "@/lib/utils";

export async function getUsers() {
  return db.select().from(users).orderBy(asc(users.name));
}

export async function getProductTypes() {
  return db.select().from(productTypes).orderBy(asc(productTypes.name));
}

export async function getPipelinesWithStages() {
  const pls = await db.select().from(pipelines).orderBy(asc(pipelines.id));
  const stages = await db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order));
  return pls.map((p) => ({
    ...p,
    stages: stages.filter((s) => s.pipelineId === p.id),
  }));
}

export async function getPeopleList(filters?: { search?: string; status?: string }) {
  const rows = await db
    .select({
      id: people.id,
      name: people.name,
      phone: people.phone,
      whatsapp: people.whatsapp,
      email: people.email,
      document: people.document,
      origin: people.origin,
      status: people.status,
      createdAt: people.createdAt,
      ownerId: people.ownerId,
      ownerName: users.name,
    })
    .from(people)
    .leftJoin(users, eq(people.ownerId, users.id))
    .orderBy(desc(people.createdAt));

  let filtered = rows;
  if (filters?.status) {
    filtered = filtered.filter((r) => r.status === filters.status);
  }
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.email ?? "").toLowerCase().includes(term) ||
        (r.document ?? "").toLowerCase().includes(term) ||
        (r.phone ?? "").toLowerCase().includes(term),
    );
  }

  const personIds = filtered.map((p) => p.id);
  const openOppCounts = personIds.length
    ? await db
        .select({
          personId: opportunities.personId,
          count: sql<number>`count(*)::int`,
        })
        .from(opportunities)
        .where(and(inArray(opportunities.personId, personIds), eq(opportunities.status, "aberta")))
        .groupBy(opportunities.personId)
    : [];
  const countMap = new Map(openOppCounts.map((r) => [r.personId, r.count]));

  return filtered.map((p) => ({ ...p, openOpportunities: countMap.get(p.id) ?? 0 }));
}

export async function getPersonById(id: number) {
  const rows = await db
    .select({
      id: people.id,
      name: people.name,
      phone: people.phone,
      whatsapp: people.whatsapp,
      email: people.email,
      document: people.document,
      origin: people.origin,
      status: people.status,
      notes: people.notes,
      createdAt: people.createdAt,
      updatedAt: people.updatedAt,
      ownerId: people.ownerId,
      ownerName: users.name,
    })
    .from(people)
    .leftJoin(users, eq(people.ownerId, users.id))
    .where(eq(people.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPersonTimeline(personId: number) {
  return db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.personId, personId))
    .orderBy(desc(timelineEvents.createdAt));
}

export async function getPersonActivities(personId: number) {
  return db
    .select({
      id: activities.id,
      type: activities.type,
      description: activities.description,
      createdAt: activities.createdAt,
      opportunityId: activities.opportunityId,
      ownerName: users.name,
    })
    .from(activities)
    .leftJoin(users, eq(activities.ownerId, users.id))
    .where(eq(activities.personId, personId))
    .orderBy(desc(activities.createdAt));
}

export async function getPersonOpportunities(personId: number) {
  const opps = await db
    .select({
      id: opportunities.id,
      product: opportunities.product,
      status: opportunities.status,
      estimatedValue: opportunities.estimatedValue,
      probability: opportunities.probability,
      origin: opportunities.origin,
      notes: opportunities.notes,
      createdAt: opportunities.createdAt,
      lastMovementAt: opportunities.lastMovementAt,
      closedAt: opportunities.closedAt,
      pipelineId: opportunities.pipelineId,
      pipelineName: pipelines.name,
      stageId: opportunities.stageId,
      stageName: pipelineStages.name,
      stageKind: pipelineStages.kind,
      stageColor: pipelineStages.color,
      ownerId: opportunities.ownerId,
      ownerName: users.name,
    })
    .from(opportunities)
    .leftJoin(pipelines, eq(opportunities.pipelineId, pipelines.id))
    .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
    .leftJoin(users, eq(opportunities.ownerId, users.id))
    .where(eq(opportunities.personId, personId))
    .orderBy(desc(opportunities.createdAt));

  const oppIds = opps.map((o) => o.id);
  const steps = oppIds.length
    ? await db
        .select()
        .from(nextSteps)
        .where(and(inArray(nextSteps.opportunityId, oppIds), eq(nextSteps.status, "pendente")))
    : [];
  const stepMap = new Map(steps.map((s) => [s.opportunityId, s]));

  return opps.map((o) => ({ ...o, nextStep: stepMap.get(o.id) ?? null }));
}

export async function getPersonProductsList(personId: number) {
  return db
    .select({
      id: personProducts.id,
      policyNumber: personProducts.policyNumber,
      insurer: personProducts.insurer,
      status: personProducts.status,
      startDate: personProducts.startDate,
      renewalDate: personProducts.renewalDate,
      premiumValue: personProducts.premiumValue,
      erpPolicyId: personProducts.erpPolicyId,
      sourceErp: personProducts.sourceErp,
      productTypeId: personProducts.productTypeId,
      productName: productTypes.name,
      createdAt: personProducts.createdAt,
    })
    .from(personProducts)
    .leftJoin(productTypes, eq(personProducts.productTypeId, productTypes.id))
    .where(eq(personProducts.personId, personId))
    .orderBy(desc(personProducts.createdAt));
}

export async function getPersonDocuments(personId: number) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.personId, personId))
    .orderBy(desc(documents.createdAt));
}

export async function getPersonCrossSell(personId: number) {
  return db
    .select({
      id: crossSellSuggestions.id,
      reason: crossSellSuggestions.reason,
      status: crossSellSuggestions.status,
      createdAt: crossSellSuggestions.createdAt,
      productTypeId: crossSellSuggestions.productTypeId,
      productName: productTypes.name,
    })
    .from(crossSellSuggestions)
    .leftJoin(productTypes, eq(crossSellSuggestions.productTypeId, productTypes.id))
    .where(eq(crossSellSuggestions.personId, personId))
    .orderBy(desc(crossSellSuggestions.createdAt));
}

export async function getPersonCustomerSuccess(personId: number) {
  return db
    .select({
      id: customerSuccessStages.id,
      stage: customerSuccessStages.stage,
      status: customerSuccessStages.status,
      dueDate: customerSuccessStages.dueDate,
      completedAt: customerSuccessStages.completedAt,
      notes: customerSuccessStages.notes,
      createdAt: customerSuccessStages.createdAt,
      opportunityId: customerSuccessStages.opportunityId,
      product: opportunities.product,
    })
    .from(customerSuccessStages)
    .leftJoin(opportunities, eq(customerSuccessStages.opportunityId, opportunities.id))
    .where(eq(customerSuccessStages.personId, personId))
    .orderBy(asc(customerSuccessStages.dueDate));
}

export async function getPersonErpSync(personId: number) {
  return db
    .select()
    .from(erpSyncLog)
    .where(eq(erpSyncLog.personId, personId))
    .orderBy(desc(erpSyncLog.syncedAt));
}

export async function getOpportunityById(id: number) {
  const rows = await db
    .select({
      id: opportunities.id,
      product: opportunities.product,
      status: opportunities.status,
      estimatedValue: opportunities.estimatedValue,
      probability: opportunities.probability,
      origin: opportunities.origin,
      notes: opportunities.notes,
      createdAt: opportunities.createdAt,
      lastMovementAt: opportunities.lastMovementAt,
      closedAt: opportunities.closedAt,
      pipelineId: opportunities.pipelineId,
      stageId: opportunities.stageId,
      ownerId: opportunities.ownerId,
      personId: opportunities.personId,
      personName: people.name,
    })
    .from(opportunities)
    .leftJoin(people, eq(opportunities.personId, people.id))
    .where(eq(opportunities.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOpportunitiesBoard(pipelineId: number) {
  const rows = await db
    .select({
      id: opportunities.id,
      product: opportunities.product,
      status: opportunities.status,
      estimatedValue: opportunities.estimatedValue,
      probability: opportunities.probability,
      stageId: opportunities.stageId,
      createdAt: opportunities.createdAt,
      lastMovementAt: opportunities.lastMovementAt,
      personId: opportunities.personId,
      personName: people.name,
      ownerName: users.name,
    })
    .from(opportunities)
    .leftJoin(people, eq(opportunities.personId, people.id))
    .leftJoin(users, eq(opportunities.ownerId, users.id))
    .where(eq(opportunities.pipelineId, pipelineId))
    .orderBy(desc(opportunities.lastMovementAt));

  const oppIds = rows.map((r) => r.id);
  const steps = oppIds.length
    ? await db
        .select()
        .from(nextSteps)
        .where(and(inArray(nextSteps.opportunityId, oppIds), eq(nextSteps.status, "pendente")))
    : [];
  const stepMap = new Map(steps.map((s) => [s.opportunityId, s]));

  return rows.map((r) => ({ ...r, nextStep: stepMap.get(r.id) ?? null }));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function getDashboardData() {
  const today = todayISO();

  const newLeads = await db
    .select({
      id: people.id,
      name: people.name,
      origin: people.origin,
      createdAt: people.createdAt,
      ownerName: users.name,
    })
    .from(people)
    .leftJoin(users, eq(people.ownerId, users.id))
    .where(eq(people.status, "lead"))
    .orderBy(desc(people.createdAt))
    .limit(8);

  const stepBase = db
    .select({
      id: nextSteps.id,
      description: nextSteps.description,
      dueDate: nextSteps.dueDate,
      dueTime: nextSteps.dueTime,
      objective: nextSteps.objective,
      opportunityId: nextSteps.opportunityId,
      personId: nextSteps.personId,
      personName: people.name,
      product: opportunities.product,
      ownerName: users.name,
    })
    .from(nextSteps)
    .leftJoin(people, eq(nextSteps.personId, people.id))
    .leftJoin(opportunities, eq(nextSteps.opportunityId, opportunities.id))
    .leftJoin(users, eq(nextSteps.ownerId, users.id));

  const followUpsToday = await stepBase.where(
    and(eq(nextSteps.status, "pendente"), eq(nextSteps.dueDate, today)),
  );

  const overdueSteps = await db
    .select({
      id: nextSteps.id,
      description: nextSteps.description,
      dueDate: nextSteps.dueDate,
      dueTime: nextSteps.dueTime,
      objective: nextSteps.objective,
      opportunityId: nextSteps.opportunityId,
      personId: nextSteps.personId,
      personName: people.name,
      product: opportunities.product,
      ownerName: users.name,
    })
    .from(nextSteps)
    .leftJoin(people, eq(nextSteps.personId, people.id))
    .leftJoin(opportunities, eq(nextSteps.opportunityId, opportunities.id))
    .leftJoin(users, eq(nextSteps.ownerId, users.id))
    .where(and(eq(nextSteps.status, "pendente"), lt(nextSteps.dueDate, today)))
    .orderBy(asc(nextSteps.dueDate));

  const openOpportunities = await db
    .select({
      id: opportunities.id,
      product: opportunities.product,
      estimatedValue: opportunities.estimatedValue,
      personName: people.name,
      personId: opportunities.personId,
      stageName: pipelineStages.name,
      ownerName: users.name,
    })
    .from(opportunities)
    .leftJoin(people, eq(opportunities.personId, people.id))
    .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
    .leftJoin(users, eq(opportunities.ownerId, users.id))
    .where(eq(opportunities.status, "aberta"))
    .orderBy(desc(opportunities.lastMovementAt));

  const crossSell = await db
    .select({
      id: crossSellSuggestions.id,
      reason: crossSellSuggestions.reason,
      personId: crossSellSuggestions.personId,
      personName: people.name,
      productName: productTypes.name,
    })
    .from(crossSellSuggestions)
    .leftJoin(people, eq(crossSellSuggestions.personId, people.id))
    .leftJoin(productTypes, eq(crossSellSuggestions.productTypeId, productTypes.id))
    .where(eq(crossSellSuggestions.status, "sugerida"))
    .orderBy(desc(crossSellSuggestions.createdAt));

  const renewals = await db
    .select({
      id: personProducts.id,
      personId: personProducts.personId,
      personName: people.name,
      productName: productTypes.name,
      renewalDate: personProducts.renewalDate,
    })
    .from(personProducts)
    .leftJoin(people, eq(personProducts.personId, people.id))
    .leftJoin(productTypes, eq(personProducts.productTypeId, productTypes.id))
    .where(
      and(
        eq(personProducts.status, "ativa"),
        gte(personProducts.renewalDate, today),
        lte(personProducts.renewalDate, sql`${today}::date + interval '45 days'`),
      ),
    )
    .orderBy(asc(personProducts.renewalDate));

  const csPending = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerSuccessStages)
    .where(eq(customerSuccessStages.status, "pendente"));

  const totalOpenValue = openOpportunities.reduce(
    (sum, o) => sum + (o.estimatedValue ? Number(o.estimatedValue) : 0),
    0,
  );

  const wonThisMonth = await db
    .select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(estimated_value),0)` })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.status, "ganha"),
        gte(opportunities.closedAt, sql`date_trunc('month', now())`),
      ),
    );

  return {
    newLeads,
    followUpsToday,
    overdueSteps,
    openOpportunities,
    crossSell,
    renewals,
    csPendingCount: csPending[0]?.count ?? 0,
    totalOpenValue,
    openCount: openOpportunities.length,
    wonThisMonthCount: wonThisMonth[0]?.count ?? 0,
    wonThisMonthValue: Number(wonThisMonth[0]?.total ?? 0),
  };
}

export async function getCrossSellList() {
  return db
    .select({
      id: crossSellSuggestions.id,
      reason: crossSellSuggestions.reason,
      status: crossSellSuggestions.status,
      createdAt: crossSellSuggestions.createdAt,
      personId: crossSellSuggestions.personId,
      personName: people.name,
      personOwnerName: users.name,
      productTypeId: crossSellSuggestions.productTypeId,
      productName: productTypes.name,
    })
    .from(crossSellSuggestions)
    .leftJoin(people, eq(crossSellSuggestions.personId, people.id))
    .leftJoin(users, eq(people.ownerId, users.id))
    .leftJoin(productTypes, eq(crossSellSuggestions.productTypeId, productTypes.id))
    .orderBy(desc(crossSellSuggestions.createdAt));
}

export async function getCustomerSuccessList() {
  return db
    .select({
      id: customerSuccessStages.id,
      stage: customerSuccessStages.stage,
      status: customerSuccessStages.status,
      dueDate: customerSuccessStages.dueDate,
      completedAt: customerSuccessStages.completedAt,
      notes: customerSuccessStages.notes,
      personId: customerSuccessStages.personId,
      personName: people.name,
      opportunityId: customerSuccessStages.opportunityId,
      product: opportunities.product,
    })
    .from(customerSuccessStages)
    .leftJoin(people, eq(customerSuccessStages.personId, people.id))
    .leftJoin(opportunities, eq(customerSuccessStages.opportunityId, opportunities.id))
    .orderBy(asc(customerSuccessStages.dueDate));
}

export async function getErpSyncLogList() {
  return db
    .select({
      id: erpSyncLog.id,
      entity: erpSyncLog.entity,
      externalId: erpSyncLog.externalId,
      status: erpSyncLog.status,
      message: erpSyncLog.message,
      syncedAt: erpSyncLog.syncedAt,
      personId: erpSyncLog.personId,
      personName: people.name,
    })
    .from(erpSyncLog)
    .leftJoin(people, eq(erpSyncLog.personId, people.id))
    .orderBy(desc(erpSyncLog.syncedAt))
    .limit(100);
}
