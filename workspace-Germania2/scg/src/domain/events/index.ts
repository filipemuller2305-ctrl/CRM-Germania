// ═══════════════════════════════════════════════════════════════════════════
// Domain Events
// Eventos emitidos quando algo relevante acontece no domínio.
// Handlers reagem a estes eventos para executar automações.
// ═══════════════════════════════════════════════════════════════════════════

// ─── BASE ────────────────────────────────────────────────────────────────────

export interface DomainEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly actorId: number | null; // quem causou o evento (null = sistema)
}

abstract class BaseEvent implements DomainEvent {
  readonly occurredAt = new Date();
  constructor(
    public readonly eventType: string,
    public readonly actorId: number | null = null
  ) {}
}

// ─── PERSON EVENTS ───────────────────────────────────────────────────────────

export class PersonCreatedEvent extends BaseEvent {
  constructor(
    public readonly personId: number,
    public readonly personName: string,
    actorId: number | null
  ) {
    super("person.created", actorId);
  }
}

export class PersonStatusChangedEvent extends BaseEvent {
  constructor(
    public readonly personId: number,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    actorId: number | null
  ) {
    super("person.status_changed", actorId);
  }
}

// ─── OPPORTUNITY EVENTS ──────────────────────────────────────────────────────

export class OpportunityCreatedEvent extends BaseEvent {
  constructor(
    public readonly opportunityId: number,
    public readonly personId: number,
    public readonly productTypeId: number,
    public readonly stageId: number,
    actorId: number | null
  ) {
    super("opportunity.created", actorId);
  }
}

export class StageChangedEvent extends BaseEvent {
  constructor(
    public readonly opportunityId: number,
    public readonly personId: number,
    public readonly previousStageId: number,
    public readonly newStageId: number,
    public readonly newStageKind: "open" | "won" | "lost",
    public readonly productName: string,
    actorId: number | null
  ) {
    super("opportunity.stage_changed", actorId);
  }
}

export class OpportunityWonEvent extends BaseEvent {
  constructor(
    public readonly opportunityId: number,
    public readonly personId: number,
    public readonly productTypeId: number,
    public readonly ownerId: number | null,
    public readonly estimatedValue: number | null,
    actorId: number | null
  ) {
    super("opportunity.won", actorId);
  }
}

export class OpportunityLostEvent extends BaseEvent {
  constructor(
    public readonly opportunityId: number,
    public readonly personId: number,
    public readonly closeOutcome: string,
    public readonly lossReason: string,
    actorId: number | null
  ) {
    super("opportunity.lost", actorId);
  }
}

// ─── NEXT STEP EVENTS ────────────────────────────────────────────────────────

export class NextStepCreatedEvent extends BaseEvent {
  constructor(
    public readonly nextStepId: number,
    public readonly opportunityId: number,
    public readonly personId: number,
    public readonly dueDate: Date,
    public readonly description: string,
    actorId: number | null
  ) {
    super("next_step.created", actorId);
  }
}

export class NextStepCompletedEvent extends BaseEvent {
  constructor(
    public readonly nextStepId: number,
    public readonly opportunityId: number,
    public readonly personId: number,
    actorId: number | null
  ) {
    super("next_step.completed", actorId);
  }
}

export class NextStepOverdueEvent extends BaseEvent {
  constructor(
    public readonly nextStepId: number,
    public readonly opportunityId: number,
    public readonly personId: number,
    public readonly personName: string,
    public readonly ownerId: number | null,
    public readonly dueDate: Date
  ) {
    super("next_step.overdue", null); // sistema
  }
}

// ─── ACTIVITY EVENTS ─────────────────────────────────────────────────────────

export class ActivityRegisteredEvent extends BaseEvent {
  constructor(
    public readonly activityId: number,
    public readonly personId: number,
    public readonly opportunityId: number | null,
    public readonly type: string,
    public readonly description: string | null,
    actorId: number | null
  ) {
    super("activity.registered", actorId);
  }
}

// ─── PRODUCT EVENTS ──────────────────────────────────────────────────────────

export class ProductActivatedEvent extends BaseEvent {
  constructor(
    public readonly personProductId: number,
    public readonly personId: number,
    public readonly productTypeId: number,
    public readonly productTypeName: string,
    actorId: number | null
  ) {
    super("product.activated", actorId);
  }
}

// ─── CROSS SELL EVENTS ───────────────────────────────────────────────────────

export class CrossSellDetectedEvent extends BaseEvent {
  constructor(
    public readonly suggestionId: number,
    public readonly personId: number,
    public readonly productTypeId: number,
    public readonly reason: string
  ) {
    super("cross_sell.detected", null); // sistema
  }
}

export class CrossSellConvertedEvent extends BaseEvent {
  constructor(
    public readonly suggestionId: number,
    public readonly personId: number,
    public readonly opportunityId: number,
    actorId: number | null
  ) {
    super("cross_sell.converted", actorId);
  }
}

// ─── CUSTOMER SUCCESS EVENTS ─────────────────────────────────────────────────

export class CustomerSuccessInitializedEvent extends BaseEvent {
  constructor(
    public readonly personId: number,
    public readonly opportunityId: number,
    public readonly stageCount: number,
    actorId: number | null
  ) {
    super("customer_success.initialized", actorId);
  }
}

export class CustomerSuccessStageCompletedEvent extends BaseEvent {
  constructor(
    public readonly stageId: number,
    public readonly personId: number,
    public readonly stageType: string,
    actorId: number | null
  ) {
    super("customer_success.stage_completed", actorId);
  }
}

// ─── RENEWAL EVENTS ──────────────────────────────────────────────────────────

export class RenewalApproachingEvent extends BaseEvent {
  constructor(
    public readonly personProductId: number,
    public readonly personId: number,
    public readonly personName: string,
    public readonly productTypeId: number,
    public readonly renewalDate: Date,
    public readonly daysUntilRenewal: number
  ) {
    super("renewal.approaching", null); // sistema/cron
  }
}

export class RenewalOpportunityCreatedEvent extends BaseEvent {
  constructor(
    public readonly opportunityId: number,
    public readonly personId: number,
    public readonly productTypeId: number,
    public readonly renewalDate: Date
  ) {
    super("renewal.opportunity_created", null); // sistema
  }
}

// ─── ERP SYNC EVENTS ─────────────────────────────────────────────────────────

export class ErpSyncCompletedEvent extends BaseEvent {
  constructor(
    public readonly entity: string,
    public readonly recordsSynced: number,
    public readonly errors: number
  ) {
    super("erp.sync_completed", null);
  }
}

// ─── EVENT MAP (para type-safety no event bus) ───────────────────────────────

export interface EventMap {
  "person.created": PersonCreatedEvent;
  "person.status_changed": PersonStatusChangedEvent;
  "opportunity.created": OpportunityCreatedEvent;
  "opportunity.stage_changed": StageChangedEvent;
  "opportunity.won": OpportunityWonEvent;
  "opportunity.lost": OpportunityLostEvent;
  "next_step.created": NextStepCreatedEvent;
  "next_step.completed": NextStepCompletedEvent;
  "next_step.overdue": NextStepOverdueEvent;
  "activity.registered": ActivityRegisteredEvent;
  "product.activated": ProductActivatedEvent;
  "cross_sell.detected": CrossSellDetectedEvent;
  "cross_sell.converted": CrossSellConvertedEvent;
  "customer_success.initialized": CustomerSuccessInitializedEvent;
  "customer_success.stage_completed": CustomerSuccessStageCompletedEvent;
  "renewal.approaching": RenewalApproachingEvent;
  "renewal.opportunity_created": RenewalOpportunityCreatedEvent;
  "erp.sync_completed": ErpSyncCompletedEvent;
}

export type EventType = keyof EventMap;
