// ═══════════════════════════════════════════════════════════════════════════
// Application Layer: Port Interfaces (Repository Contracts)
// Define os contratos que a camada de infraestrutura deve implementar.
// A camada de aplicação depende APENAS destas interfaces, nunca do Drizzle.
// ═══════════════════════════════════════════════════════════════════════════

import type { Person, PersonProps, CreatePersonInput } from "@/domain/entities/person.entity";
import type { Lead } from "@/domain/entities/lead.entity";
import type { Opportunity, OpportunityProps } from "@/domain/entities/opportunity.entity";
import type { NextStep, NextStepProps } from "@/domain/entities/next-step.entity";
import type { Activity } from "@/domain/entities/activity.entity";
import type { PersonProduct } from "@/domain/entities/person-product.entity";
import type { CustomerSuccessStage } from "@/domain/entities/customer-success-stage.entity";
import type { ScheduledCommercialReturn } from "@/domain/entities/scheduled-commercial-return.entity";
import type { OpportunityStatus, NextStepStatus, ProductStatus } from "@/domain/types";

// ─── PAGINATION ──────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  cursor: number | null; // último ID para próxima página
  hasMore: boolean;
}

export interface PaginationParams {
  limit?: number;
  cursor?: number | null; // último ID da página anterior
}

// ─── PERSON REPOSITORY ───────────────────────────────────────────────────────

export interface PersonRepository {
  findById(id: number): Promise<Person | null>;
  findByDocument(document: string): Promise<Person | null>;
  findByEmail(email: string): Promise<Person | null>;
  findByErpCustomerId(erpId: string): Promise<Person | null>;
  list(params: {
    status?: string;
    relationshipOwnerId?: number;
    search?: string;
    pagination?: PaginationParams;
  }): Promise<PaginatedResult<Person>>;
  create(person: Person): Promise<Person>;
  update(person: Person): Promise<Person>;
}

// ─── LEAD REPOSITORY ────────────────────────────────────────────────────────

export interface LeadRepository {
  findById(id: number): Promise<Lead | null>;
  findByOpportunityId(opportunityId: number): Promise<Lead | null>;
  findOpenByPersonId(personId: number): Promise<Lead[]>;
  create(lead: Lead): Promise<Lead>;
  update(lead: Lead): Promise<Lead>;
}

// ─── OPPORTUNITY REPOSITORY ──────────────────────────────────────────────────

export interface OpportunityRepository {
  findById(id: number): Promise<Opportunity | null>;
  findByPersonId(personId: number): Promise<Opportunity[]>;
  findByLeadId(leadId: number): Promise<Opportunity | null>;
  findByRenewalKey(renewalKey: string): Promise<Opportunity | null>;
  findByRecoveryKey(recoveryKey: string): Promise<Opportunity | null>;
  listRenewals(): Promise<Opportunity[]>;
  findOpenByPersonAndProduct(personId: number, productTypeId: number): Promise<Opportunity | null>;
  listByPipeline(pipelineId: number): Promise<Opportunity[]>;
  listOpen(params?: PaginationParams): Promise<PaginatedResult<Opportunity>>;
  create(opportunity: Opportunity): Promise<Opportunity>;
  update(opportunity: Opportunity): Promise<Opportunity>;
  countOpenByOwner(ownerId: number): Promise<number>;
}

// ─── SCHEDULED COMMERCIAL RETURN REPOSITORY ─────────────────────────────────

export interface ScheduledCommercialReturnRepository {
  findById(id: number): Promise<ScheduledCommercialReturn | null>;
  findBySourceOpportunityId(
    sourceOpportunityId: number
  ): Promise<ScheduledCommercialReturn | null>;
  findDue(referenceDate?: Date): Promise<ScheduledCommercialReturn[]>;
  create(
    commercialReturn: ScheduledCommercialReturn
  ): Promise<ScheduledCommercialReturn>;
  update(
    commercialReturn: ScheduledCommercialReturn
  ): Promise<ScheduledCommercialReturn>;
}

// ─── NEXT STEP REPOSITORY ────────────────────────────────────────────────────

export interface NextStepRepository {
  findById(id: number): Promise<NextStep | null>;
  findPendingByOpportunity(opportunityId: number): Promise<NextStep[]>;
  findPendingByOwner(ownerId: number): Promise<NextStep[]>;
  findOverdue(): Promise<NextStep[]>;
  findDueToday(ownerId?: number): Promise<NextStep[]>;
  create(nextStep: NextStep): Promise<NextStep>;
  update(nextStep: NextStep): Promise<NextStep>;
}

// ─── ACTIVITY REPOSITORY ─────────────────────────────────────────────────────

export interface ActivityRepository {
  findById(id: number): Promise<Activity | null>;
  findByPersonId(personId: number, pagination?: PaginationParams): Promise<PaginatedResult<Activity>>;
  create(activity: Activity): Promise<Activity>;
}

// ─── PERSON PRODUCT REPOSITORY ───────────────────────────────────────────────

export interface PersonProductRepository {
  findById(id: number): Promise<PersonProduct | null>;
  findByPersonId(personId: number): Promise<PersonProduct[]>;
  findActiveByPersonId(personId: number): Promise<PersonProduct[]>;
  findRenewable(
    windowDays: number,
    overdueLookbackDays?: number
  ): Promise<PersonProduct[]>;
  create(product: PersonProduct): Promise<PersonProduct>;
  update(product: PersonProduct): Promise<PersonProduct>;
}

// ─── CUSTOMER SUCCESS REPOSITORY ─────────────────────────────────────────────

export interface CustomerSuccessRepository {
  findByPersonId(personId: number): Promise<CustomerSuccessStage[]>;
  findByOpportunityId(opportunityId: number): Promise<CustomerSuccessStage[]>;
  findPending(): Promise<CustomerSuccessStage[]>;
  create(stage: CustomerSuccessStage): Promise<CustomerSuccessStage>;
  createMany(stages: CustomerSuccessStage[]): Promise<CustomerSuccessStage[]>;
  update(stage: CustomerSuccessStage): Promise<CustomerSuccessStage>;
}

// ─── TIMELINE REPOSITORY ─────────────────────────────────────────────────────

export interface TimelineEventInput {
  personId: number;
  leadId?: number | null;
  opportunityId?: number | null;
  actorId?: number | null;
  type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ─── TRANSACTION ────────────────────────────────────────────────────────────

export interface TransactionRepositories {
  person: PersonRepository;
  lead: LeadRepository;
  opportunity: OpportunityRepository;
  nextStep: NextStepRepository;
  activity: ActivityRepository;
  scheduledCommercialReturn: ScheduledCommercialReturnRepository;
  timeline: TimelineRepository;
}

export interface TransactionManager {
  run<T>(
    work: (repositories: TransactionRepositories) => Promise<T>
  ): Promise<T>;
}

export interface TimelineRepository {
  /** INSERT ONLY — nunca update ou delete (INV-03) */
  add(event: TimelineEventInput): Promise<void>;
  findByPersonId(personId: number, pagination?: PaginationParams): Promise<PaginatedResult<any>>;
}

// ─── CROSS SELL REPOSITORY ───────────────────────────────────────────────────

export interface CrossSellSuggestionData {
  personId: number;
  productTypeId: number;
  reason: string;
  status: string;
  opportunityId?: number | null;
}

export interface CrossSellRepository {
  findByPersonId(personId: number): Promise<CrossSellSuggestionData[]>;
  findSuggested(): Promise<CrossSellSuggestionData[]>;
  findSuggestedProductTypeIds(personId: number): Promise<number[]>;
  create(data: CrossSellSuggestionData): Promise<{ id: number }>;
  updateStatus(id: number, status: string, opportunityId?: number): Promise<void>;
}

// ─── PIPELINE / STAGE REPOSITORY ─────────────────────────────────────────────

export interface StageData {
  id: number;
  pipelineId: number;
  name: string;
  order: number;
  kind: "open" | "won" | "lost";
  color: string;
}

export interface PipelineRepository {
  getStageById(stageId: number): Promise<StageData | null>;
  getStagesByPipeline(pipelineId: number): Promise<StageData[]>;
  getDefaultPipeline(): Promise<{ id: number; name: string } | null>;
}

// ─── USER REPOSITORY ─────────────────────────────────────────────────────────

export interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface UserRepository {
  findById(id: number): Promise<UserData | null>;
  findByEmail(email: string): Promise<UserData | null>;
  list(): Promise<UserData[]>;
}
