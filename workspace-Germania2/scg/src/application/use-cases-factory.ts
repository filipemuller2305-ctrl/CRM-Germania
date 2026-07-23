// ═══════════════════════════════════════════════════════════════════════════
// Use Cases Factory
// Cria instâncias de use cases com repositórios injetados.
// Facilita o uso em Server Actions e API Routes.
// ═══════════════════════════════════════════════════════════════════════════

import { getRepositories } from "@/infrastructure/db/repositories";
import { CreatePersonUseCase } from "./person/create-person.usecase";
import { CreateOpportunityUseCase } from "./opportunity/create-opportunity.usecase";
import { MoveStageUseCase } from "./opportunity/move-stage.usecase";
import { RegisterActivityUseCase } from "./activity/register-activity.usecase";
import { CompleteNextStepUseCase } from "./next-step/complete-next-step.usecase";

/**
 * Factory de Use Cases.
 * Uso em Server Actions:
 *
 *   const uc = getUseCases();
 *   const result = await uc.createPerson.execute(input, userId);
 */
export function getUseCases() {
  const repos = getRepositories();

  return {
    createPerson: new CreatePersonUseCase(
      repos.person,
      repos.timeline
    ),

    createOpportunity: new CreateOpportunityUseCase(
      repos.opportunity,
      repos.nextStep,
      repos.person,
      repos.pipeline,
      repos.timeline
    ),

    moveStage: new MoveStageUseCase(
      repos.opportunity,
      repos.nextStep,
      repos.pipeline,
      repos.timeline
    ),

    registerActivity: new RegisterActivityUseCase(
      repos.activity,
      repos.nextStep,
      repos.opportunity,
      repos.timeline
    ),

    completeNextStep: new CompleteNextStepUseCase(
      repos.nextStep,
      repos.opportunity,
      repos.timeline
    ),
  };
}

export type UseCases = ReturnType<typeof getUseCases>;
