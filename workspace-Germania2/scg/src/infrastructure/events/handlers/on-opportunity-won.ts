// ═══════════════════════════════════════════════════════════════════════════
// Event Handler: On Opportunity Won
// INV-06: Quando oportunidade é ganha → cria Customer Success automaticamente
// Também atualiza status da Pessoa para "cliente" (se primeiro produto)
// ═══════════════════════════════════════════════════════════════════════════

import type { OpportunityWonEvent } from "@/domain/events";
import { CustomerSuccessStage } from "@/domain/entities/customer-success-stage.entity";
import { PersonStatus } from "@/domain/types";
import type {
  CustomerSuccessRepository,
  PersonRepository,
  PersonProductRepository,
  TimelineRepository,
} from "@/application/ports";

export class OnOpportunityWonHandler {
  constructor(
    private csRepo: CustomerSuccessRepository,
    private personRepo: PersonRepository,
    private personProductRepo: PersonProductRepository,
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

    // ─── 2. Atualiza status da Pessoa para "cliente" se necessário ─────────
    const person = await this.personRepo.findById(personId);
    if (person && person.status !== PersonStatus.CLIENTE) {
      person.markAsClient();
      await this.personRepo.update(person);

      await this.timelineRepo.add({
        personId,
        actorId: event.actorId,
        type: "person_updated",
        title: "Status alterado para Cliente",
        description: `${person.name} agora é cliente Germânia Seguros. 🎉`,
      });
    }

    // ─── 3. Timeline de Customer Success iniciado ──────────────────────────
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
