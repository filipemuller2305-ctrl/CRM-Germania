import type {
  TransactionManager,
  TransactionRepositories,
} from "@/application/ports";
import { db, type Database } from "./index";
import { DrizzleActivityRepository } from "./repositories/activity.repository";
import { DrizzleLeadRepository } from "./repositories/lead.repository";
import { DrizzleNextStepRepository } from "./repositories/next-step.repository";
import { DrizzleOpportunityRepository } from "./repositories/opportunity.repository";
import { DrizzlePersonRepository } from "./repositories/person.repository";
import { DrizzleTimelineRepository } from "./repositories/timeline.repository";

export class DrizzleTransactionManager implements TransactionManager {
  async run<T>(
    work: (repositories: TransactionRepositories) => Promise<T>
  ): Promise<T> {
    return db.transaction(async (tx) => {
      const database = tx as unknown as Database;
      return work({
        person: new DrizzlePersonRepository(database),
        lead: new DrizzleLeadRepository(database),
        opportunity: new DrizzleOpportunityRepository(database),
        nextStep: new DrizzleNextStepRepository(database),
        activity: new DrizzleActivityRepository(database),
        timeline: new DrizzleTimelineRepository(database),
      });
    });
  }
}
