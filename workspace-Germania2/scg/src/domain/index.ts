// ═══════════════════════════════════════════════════════════════════════════
// Domain Layer — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════

// Types & Enums
export * from "./types";

// Value Objects
export { CpfCnpj, CpfCnpjInvalidError } from "./value-objects/cpf-cnpj";
export { Phone, PhoneInvalidError } from "./value-objects/phone";
export { Money, MoneyInvalidError } from "./value-objects/money";

// Entities
export { Person, PersonValidationError } from "./entities/person.entity";
export type { PersonProps, CreatePersonInput } from "./entities/person.entity";

export { Lead, LeadValidationError } from "./entities/lead.entity";
export type { LeadProps, CreateLeadInput } from "./entities/lead.entity";

export { Opportunity, OpportunityValidationError } from "./entities/opportunity.entity";
export type { OpportunityProps, CreateOpportunityInput } from "./entities/opportunity.entity";

export { NextStep, NextStepValidationError } from "./entities/next-step.entity";
export type { NextStepProps, CreateNextStepInput } from "./entities/next-step.entity";

export { Activity, ActivityValidationError } from "./entities/activity.entity";
export type { ActivityProps, CreateActivityInput } from "./entities/activity.entity";

export { PersonProduct, PersonProductValidationError } from "./entities/person-product.entity";
export type { PersonProductProps, CreatePersonProductInput } from "./entities/person-product.entity";

export { CustomerSuccessStage, CustomerSuccessValidationError } from "./entities/customer-success-stage.entity";
export type { CustomerSuccessStageProps } from "./entities/customer-success-stage.entity";

// Domain Events
export * from "./events";

// Domain Services
export { CrossSellEngine } from "./services/cross-sell-engine";
export type { CrossSellRule, PersonProductSnapshot, CrossSellSuggestionOutput } from "./services/cross-sell-engine";

export {
  RenewalDetector,
  RenewalValidationError,
  RENEWAL_WINDOW_DAYS,
  RENEWAL_OVERDUE_LOOKBACK_DAYS,
} from "./services/renewal-detector";
export type {
  RenewableProduct,
  ExistingRenewalRef,
  RenewalCandidate,
} from "./services/renewal-detector";

export { OpportunityInvariants, InvariantViolationError } from "./services/opportunity-invariants";
export type { StageRef, NextStepRef } from "./services/opportunity-invariants";
