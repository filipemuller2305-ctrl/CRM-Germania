export * from "./ports";

export {
  CreatePersonUseCase,
  createPersonSchema,
} from "./person/create-person.usecase";
export {
  CreateLeadUseCase,
  createLeadSchema,
} from "./lead/create-lead.usecase";
export {
  ConvertLeadUseCase,
  convertLeadSchema,
} from "./lead/convert-lead.usecase";
export {
  CreateOpportunityUseCase,
  createOpportunitySchema,
} from "./opportunity/create-opportunity.usecase";
export {
  MoveStageUseCase,
  moveStageSchema,
} from "./opportunity/move-stage.usecase";
export {
  RegisterActivityUseCase,
  registerActivitySchema,
} from "./activity/register-activity.usecase";
export {
  CompleteNextStepUseCase,
  completeNextStepSchema,
} from "./next-step/complete-next-step.usecase";
export { getUseCases } from "./use-cases-factory";
