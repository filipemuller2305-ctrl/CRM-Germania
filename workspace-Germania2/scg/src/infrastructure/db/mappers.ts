// ═══════════════════════════════════════════════════════════════════════════
// SCG — Mappers (DB rows ↔ Domain Entities)
// Funções de conversão entre linhas do banco e entidades de domínio
// ═══════════════════════════════════════════════════════════════════════════

import { Person, type PersonProps } from "@/domain/entities/person.entity";
import { Lead, type LeadProps } from "@/domain/entities/lead.entity";
import { Opportunity, type OpportunityProps } from "@/domain/entities/opportunity.entity";
import { NextStep, type NextStepProps } from "@/domain/entities/next-step.entity";
import { Activity, type ActivityProps } from "@/domain/entities/activity.entity";
import { PersonProduct, type PersonProductProps } from "@/domain/entities/person-product.entity";
import { CustomerSuccessStage, type CustomerSuccessStageProps } from "@/domain/entities/customer-success-stage.entity";
import {
  ScheduledCommercialReturn,
  type ScheduledCommercialReturnProps,
} from "@/domain/entities/scheduled-commercial-return.entity";
import { CpfCnpj } from "@/domain/value-objects/cpf-cnpj";
import { Phone } from "@/domain/value-objects/phone";
import { Money } from "@/domain/value-objects/money";
import type {
  PersonStatus,
  PersonType,
  ContactSource,
  EntryChannel,
  LeadDiscardReason,
  LeadStatus,
  OpportunityType,
  OpportunityStatus,
  OpportunityCloseOutcome,
  OpportunityLossReason,
  ScheduledCommercialReturnStatus,
  NextStepStatus,
  ActivityType,
  ProductStatus,
  ProductSource,
  CustomerSuccessStageType,
  CustomerSuccessStageStatus,
} from "@/domain/types";
import type * as S from "./schema";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function parseDate(d: string | Date | null): Date | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? null : date;
}

function parseDateOnly(d: string | null): Date | null {
  if (!d) return null;
  return new Date(d + "T00:00:00");
}

function toDateString(d: Date | null): string | null {
  return d ? d.toISOString().split("T")[0] : null;
}

// ─── PERSON ──────────────────────────────────────────────────────────────────

type PersonRow = typeof S.people.$inferSelect;

export function personToDomain(row: PersonRow): Person {
  return Person.reconstitute({
    id: row.id,
    name: row.name,
    type: row.type as PersonType,
    phone: row.phone ? Phone.optional(row.phone) : null,
    whatsapp: row.whatsapp ? Phone.optional(row.whatsapp) : null,
    email: row.email,
    document: row.document ? CpfCnpj.fromErp(row.document) : null,
    status: row.status as PersonStatus,
    relationshipOwnerId: row.relationshipOwnerId,
    notes: row.notes,
    erpCustomerId: row.erpCustomerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as PersonProps);
}

export function personToDb(person: Person): Partial<PersonRow> {
  return {
    name: person.name,
    type: person.type,
    phone: person.phone?.value ?? null,
    whatsapp: person.whatsapp?.value ?? null,
    email: person.email,
    document: person.documentValue,
    status: person.status,
    relationshipOwnerId: person.relationshipOwnerId,
    notes: person.notes,
    erpCustomerId: person.erpCustomerId,
    updatedAt: new Date(),
  };
}

// ─── LEAD ────────────────────────────────────────────────────────────────────

type LeadRow = typeof S.leads.$inferSelect;

export function leadToDomain(row: LeadRow): Lead {
  return Lead.reconstitute({
    id: row.id,
    personId: row.personId,
    productTypeId: row.productTypeId,
    source: row.source as ContactSource,
    channel: row.channel as EntryChannel,
    campaign: row.campaign,
    referredByPersonId: row.referredByPersonId,
    sourceDetail: row.sourceDetail,
    capturedById: row.capturedById,
    ownerId: row.ownerId,
    status: row.status as LeadStatus,
    opportunityId: row.opportunityId,
    discardReason: row.discardReason as LeadDiscardReason | null,
    discardNotes: row.discardNotes,
    createdAt: row.createdAt,
    qualificationStartedAt: parseDate(row.qualificationStartedAt),
    qualifiedAt: parseDate(row.qualifiedAt),
    convertedAt: parseDate(row.convertedAt),
    discardedAt: parseDate(row.discardedAt),
    archivedAt: parseDate(row.archivedAt),
  } as LeadProps);
}

export function leadToDb(lead: Lead): typeof S.leads.$inferInsert {
  return lead.toPersistence();
}

// ─── OPPORTUNITY ─────────────────────────────────────────────────────────────

type OpportunityRow = typeof S.opportunities.$inferSelect;

export function opportunityToDomain(row: OpportunityRow): Opportunity {
  return Opportunity.reconstitute({
    id: row.id,
    personId: row.personId,
    leadId: row.leadId,
    personProductId: row.personProductId,
    crossSellSuggestionId: row.crossSellSuggestionId,
    productTypeId: row.productTypeId,
    pipelineId: row.pipelineId,
    stageId: row.stageId,
    ownerId: row.ownerId,
    createdById: row.createdById,
    type: row.type as OpportunityType,
    estimatedValue: row.estimatedValue ? Money.fromReais(Number(row.estimatedValue)) : null,
    probability: row.probability,
    attribution: {
      source: row.source as ContactSource,
      channel: row.channel as EntryChannel,
      campaign: row.campaign,
      referredByPersonId: row.referredByPersonId,
      sourceDetail: row.sourceDetail,
    },
    renewalKey: row.renewalKey,
    recoveryKey: row.recoveryKey,
    status: row.status as OpportunityStatus,
    closeOutcome: row.closeOutcome as OpportunityCloseOutcome | null,
    lossReason: row.lossReason as OpportunityLossReason | null,
    closeNotes: row.closeNotes,
    nextExpirationDate: parseDateOnly(row.nextExpirationDate),
    notes: row.notes,
    createdAt: row.createdAt,
    lastMovementAt: row.lastMovementAt,
    closedAt: parseDate(row.closedAt as any),
  } as OpportunityProps);
}

export function opportunityToDb(opp: Opportunity): Partial<OpportunityRow> {
  return {
    personId: opp.personId,
    leadId: opp.leadId,
    personProductId: opp.personProductId,
    crossSellSuggestionId: opp.crossSellSuggestionId,
    productTypeId: opp.productTypeId,
    pipelineId: opp.pipelineId,
    stageId: opp.stageId,
    ownerId: opp.ownerId,
    createdById: opp.createdById,
    type: opp.type,
    estimatedValue: opp.estimatedValue ? String(opp.estimatedValue.reais) : null,
    probability: opp.probability,
    source: opp.attribution.source,
    channel: opp.attribution.channel,
    campaign: opp.attribution.campaign,
    referredByPersonId: opp.attribution.referredByPersonId,
    sourceDetail: opp.attribution.sourceDetail,
    renewalKey: opp.renewalKey,
    recoveryKey: opp.recoveryKey,
    status: opp.status,
    closeOutcome: opp.closeOutcome,
    lossReason: opp.lossReason,
    closeNotes: opp.closeNotes,
    nextExpirationDate: toDateString(opp.nextExpirationDate),
    notes: opp.notes,
    lastMovementAt: opp.lastMovementAt,
    closedAt: opp.closedAt,
  };
}

// ─── SCHEDULED COMMERCIAL RETURN ─────────────────────────────────────────────

type ScheduledCommercialReturnRow =
  typeof S.scheduledCommercialReturns.$inferSelect;

export function scheduledCommercialReturnToDomain(
  row: ScheduledCommercialReturnRow
): ScheduledCommercialReturn {
  return ScheduledCommercialReturn.reconstitute({
    id: row.id,
    personId: row.personId,
    sourceOpportunityId: row.sourceOpportunityId,
    createdOpportunityId: row.createdOpportunityId,
    productTypeId: row.productTypeId,
    ownerId: row.ownerId,
    closeOutcome: row.closeOutcome as OpportunityCloseOutcome,
    nextExpirationDate: parseDateOnly(row.nextExpirationDate)!,
    scheduledFor: parseDateOnly(row.scheduledFor)!,
    notes: row.notes,
    status: row.status as ScheduledCommercialReturnStatus,
    createdAt: row.createdAt,
    processedAt: parseDate(row.processedAt),
    cancelledAt: parseDate(row.cancelledAt),
  } as ScheduledCommercialReturnProps);
}

export function scheduledCommercialReturnToDb(
  commercialReturn: ScheduledCommercialReturn
): typeof S.scheduledCommercialReturns.$inferInsert {
  const data = commercialReturn.toPersistence();
  return {
    personId: data.personId,
    sourceOpportunityId: data.sourceOpportunityId,
    createdOpportunityId: data.createdOpportunityId,
    productTypeId: data.productTypeId,
    ownerId: data.ownerId,
    closeOutcome: data.closeOutcome,
    nextExpirationDate: toDateString(data.nextExpirationDate)!,
    scheduledFor: toDateString(data.scheduledFor)!,
    notes: data.notes,
    status: data.status,
    processedAt: data.processedAt,
    cancelledAt: data.cancelledAt,
  };
}

// ─── NEXT STEP ───────────────────────────────────────────────────────────────

type NextStepRow = typeof S.nextSteps.$inferSelect;

export function nextStepToDomain(row: NextStepRow): NextStep {
  return NextStep.reconstitute({
    id: row.id,
    opportunityId: row.opportunityId,
    ownerId: row.ownerId,
    description: row.description,
    dueDate: new Date(row.dueDate + "T00:00:00"),
    dueTime: row.dueTime,
    objective: row.objective,
    status: row.status as NextStepStatus,
    createdAt: row.createdAt,
    completedAt: parseDate(row.completedAt as any),
  } as NextStepProps);
}

export function nextStepToDb(ns: NextStep): Partial<NextStepRow> {
  return {
    opportunityId: ns.opportunityId,
    ownerId: ns.ownerId,
    description: ns.description,
    dueDate: toDateString(ns.dueDate)!,
    dueTime: ns.dueTime,
    objective: ns.objective,
    status: ns.status,
    completedAt: ns.completedAt,
  };
}

// ─── ACTIVITY ────────────────────────────────────────────────────────────────

type ActivityRow = typeof S.activities.$inferSelect;

export function activityToDomain(row: ActivityRow): Activity {
  return Activity.reconstitute({
    id: row.id,
    personId: row.personId,
    leadId: row.leadId,
    opportunityId: row.opportunityId,
    ownerId: row.ownerId,
    type: row.type as ActivityType,
    description: row.description,
    createdAt: row.createdAt,
  } as ActivityProps);
}

export function activityToDb(act: Activity): Partial<ActivityRow> {
  return {
    personId: act.personId,
    leadId: act.leadId,
    opportunityId: act.opportunityId,
    ownerId: act.ownerId,
    type: act.type,
    description: act.description,
  };
}

// ─── PERSON PRODUCT ──────────────────────────────────────────────────────────

type PersonProductRow = typeof S.personProducts.$inferSelect;

export function personProductToDomain(row: PersonProductRow): PersonProduct {
  return PersonProduct.reconstitute({
    id: row.id,
    personId: row.personId,
    productTypeId: row.productTypeId,
    policyNumber: row.policyNumber,
    insurer: row.insurer,
    status: row.status as ProductStatus,
    startDate: parseDateOnly(row.startDate),
    renewalDate: parseDateOnly(row.renewalDate),
    premiumValue: row.premiumValue ? Money.fromReais(Number(row.premiumValue)) : null,
    erpPolicyId: row.erpPolicyId,
    source: row.source as ProductSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as PersonProductProps);
}

export function personProductToDb(pp: PersonProduct): Partial<PersonProductRow> {
  return {
    personId: pp.personId,
    productTypeId: pp.productTypeId,
    policyNumber: pp.policyNumber,
    insurer: pp.insurer,
    status: pp.status,
    startDate: toDateString(pp.startDate),
    renewalDate: toDateString(pp.renewalDate),
    premiumValue: pp.premiumValue ? String(pp.premiumValue.reais) : null,
    erpPolicyId: pp.erpPolicyId,
    source: pp.source,
    updatedAt: new Date(),
  };
}

// ─── CUSTOMER SUCCESS STAGE ──────────────────────────────────────────────────

type CsStageRow = typeof S.customerSuccessStages.$inferSelect;

export function csStageToDomain(row: CsStageRow): CustomerSuccessStage {
  return CustomerSuccessStage.reconstitute({
    id: row.id,
    personId: row.personId,
    opportunityId: row.opportunityId,
    ownerId: row.ownerId,
    stage: row.stage as CustomerSuccessStageType,
    status: row.status as CustomerSuccessStageStatus,
    dueDate: parseDateOnly(row.dueDate),
    completedAt: parseDate(row.completedAt as any),
    notes: row.notes,
    createdAt: row.createdAt,
  } as CustomerSuccessStageProps);
}

export function csStageToDb(cs: CustomerSuccessStage): Partial<CsStageRow> {
  return {
    personId: cs.personId,
    opportunityId: cs.opportunityId,
    ownerId: cs.ownerId,
    stage: cs.stage,
    status: cs.status,
    dueDate: toDateString(cs.dueDate),
    completedAt: cs.completedAt,
    notes: cs.notes,
  };
}
