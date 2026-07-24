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
import { ConvertLeadUseCase } from "./lead/convert-lead.usecase";
import { CreateLeadUseCase } from "./lead/create-lead.usecase";
import { DrizzleTransactionManager } from "@/infrastructure/db/transaction-manager";

/**
 * Factory de Use Cases.
 * Uso em Server Actions:
 *
 *   const uc = getUseCases();
 *   const result = await uc.createPerson.execute(input, userId);
 */
export function getUseCases() {
  const repos = getRepositories();
  const transaction = new DrizzleTransactionManager();

  return {
    createPerson: new CreatePersonUseCase(
      transaction
    ),

    createLead: new CreateLeadUseCase(transaction),
    convertLead: new ConvertLeadUseCase(transaction, repos.pipeline),

    createOpportunity: new CreateOpportunityUseCase(
      transaction,
      repos.person,
      repos.pipeline
    ),

    moveStage: new MoveStageUseCase(
      repos.opportunity,
      repos.pipeline,
      transaction
    ),

    registerActivity: new RegisterActivityUseCase(
      transaction
    ),

    completeNextStep: new CompleteNextStepUseCase(
      repos.nextStep,
      repos.opportunity,
      repos.timeline
    ),
  };
}

export type UseCases = ReturnType<typeof getUseCases>;
