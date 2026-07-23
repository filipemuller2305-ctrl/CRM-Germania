// ═══════════════════════════════════════════════════════════════════════════
// Repository Factory (Dependency Injection)
// Centraliza a criação de repositórios e fornece acesso facilitado.
// ═══════════════════════════════════════════════════════════════════════════

import { DrizzlePersonRepository } from "./person.repository";
import { DrizzleOpportunityRepository } from "./opportunity.repository";
import { DrizzleNextStepRepository } from "./next-step.repository";
import { DrizzleActivityRepository } from "./activity.repository";
import { DrizzlePersonProductRepository } from "./person-product.repository";
import { DrizzleCustomerSuccessRepository } from "./customer-success.repository";
import { DrizzleTimelineRepository } from "./timeline.repository";
import { DrizzleCrossSellRepository } from "./cross-sell.repository";
import { DrizzlePipelineRepository } from "./pipeline.repository";
import { DrizzleUserRepository } from "./user.repository";
import type {
  PersonRepository,
  OpportunityRepository,
  NextStepRepository,
  ActivityRepository,
  PersonProductRepository,
  CustomerSuccessRepository,
  TimelineRepository,
  CrossSellRepository,
  PipelineRepository,
  UserRepository,
} from "@/application/ports";

// ─── REPOSITORIES INTERFACE ──────────────────────────────────────────────────

export interface Repositories {
  person: PersonRepository;
  opportunity: OpportunityRepository;
  nextStep: NextStepRepository;
  activity: ActivityRepository;
  personProduct: PersonProductRepository;
  customerSuccess: CustomerSuccessRepository;
  timeline: TimelineRepository;
  crossSell: CrossSellRepository;
  pipeline: PipelineRepository;
  user: UserRepository;
}

// ─── SINGLETON INSTANCES ─────────────────────────────────────────────────────
// Repositórios são stateless — uma instância por processo é suficiente.

let _instance: Repositories | null = null;

/**
 * Retorna a instância singleton de todos os repositórios.
 * Uso: `const repos = getRepositories();`
 */
export function getRepositories(): Repositories {
  if (!_instance) {
    _instance = {
      person: new DrizzlePersonRepository(),
      opportunity: new DrizzleOpportunityRepository(),
      nextStep: new DrizzleNextStepRepository(),
      activity: new DrizzleActivityRepository(),
      personProduct: new DrizzlePersonProductRepository(),
      customerSuccess: new DrizzleCustomerSuccessRepository(),
      timeline: new DrizzleTimelineRepository(),
      crossSell: new DrizzleCrossSellRepository(),
      pipeline: new DrizzlePipelineRepository(),
      user: new DrizzleUserRepository(),
    };
  }
  return _instance;
}

// ─── INDIVIDUAL EXPORTS ──────────────────────────────────────────────────────

export {
  DrizzlePersonRepository,
  DrizzleOpportunityRepository,
  DrizzleNextStepRepository,
  DrizzleActivityRepository,
  DrizzlePersonProductRepository,
  DrizzleCustomerSuccessRepository,
  DrizzleTimelineRepository,
  DrizzleCrossSellRepository,
  DrizzlePipelineRepository,
  DrizzleUserRepository,
};
