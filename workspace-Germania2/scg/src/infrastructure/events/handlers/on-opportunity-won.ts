// ═══════════════════════════════════════════════════════════════════════════
// Event Handler: On Opportunity Won
// INV-06: Quando oportunidade é ganha → cria Customer Success automaticamente
// Também atualiza status da Pessoa para "cliente" (se primeiro produto)
// ═══════════════════════════════════════════════════════════════════════════

import type { OpportunityWonEvent } from "@/domain/events";
import { CustomerSuccessStage } from "@/domain/entities/customer-success-stage.entity";
import type {
  CustomerSuccessRepository,
  TimelineRepository,
} from "@/application/ports";

export class OnOpportunityWonHandler {
  constructor(
    private csRepo: CustomerSuccessRepository,
    private timelineRepo: TimelineRepository
  ) {}

  async handle(event: OpportunityWonEvent): Promise<void> {
    const { personId, opportunityId, ownerId } = event;

    // ─── 1. Cria as 6 etapas de Customer Success ───────────────────────────
    const closedAt = new Date(); // momento do fechamento
    const csStages = CustomerSuccessStage.createAllForOpportunity(
      personId,
      opportunityId,
      ownerId,
      closedAt
    );

    await this.csRepo.createMany(csStages);

    // Cliente é uma condição derivada de produto ativo; não alteramos Pessoa.
    // ─── 2. Timeline de Customer Success iniciado ──────────────────────────
    await this.timelineRepo.add({
      personId,
      opportunityId,
      actorId: null, // sistema
      type: "customer_success",
      title: "Jornada de Customer Success iniciada",
      description: `${csStages.length} etapas de acompanhamento pós-venda foram criadas automaticamente.`,
      metadata: {
        stages: csStages.map((s) => ({
          stage: s.stage,
          dueDate: s.dueDate?.toISOString().split("T")[0],
        })),
      },
    });

    console.log(
      `[OnOpportunityWon] CS inicializado para pessoa ${personId}, ` +
      `oportunidade ${opportunityId}, ${csStages.length} etapas criadas.`
    );
  }
}
