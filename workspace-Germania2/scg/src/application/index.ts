// ═══════════════════════════════════════════════════════════════════════════
// Application Layer — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════

// Port interfaces (repository contracts)
export * from "./ports";

// Use Cases — Person
export { CreatePersonUseCase, createPersonSchema } from "./person/create-person.usecase";
export type { CreatePersonResult } from "./person/create-person.usecase";

// Use Cases — Opportunity
export { CreateOpportunityUseCase, createOpportunitySchema } from "./opportunity/create-opportunity.usecase";
export type { CreateOpportunityResult } from "./opportunity/create-opportunity.usecase";

export { MoveStageUseCase, moveStageSchema } from "./opportunity/move-stage.usecase";
export type { MoveStageResult } from "./opportunity/move-stage.usecase";

// Use Cases — Activity
export { RegisterActivityUseCase, registerActivitySchema } from "./activity/register-activity.usecase";
export type { RegisterActivityResult } from "./activity/register-activity.usecase";

// Use Cases — Next Step
export { CompleteNextStepUseCase, completeNextStepSchema } from "./next-step/complete-next-step.usecase";
export type { CompleteNextStepResult } from "./next-step/complete-next-step.usecase";
