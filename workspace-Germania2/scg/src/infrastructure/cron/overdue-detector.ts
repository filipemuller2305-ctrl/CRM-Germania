// ═══════════════════════════════════════════════════════════════════════════
// Cron Job: Overdue Detector
// Roda diariamente. Marca next steps expirados e emite eventos de alerta.
// ═══════════════════════════════════════════════════════════════════════════

import { NextStepOverdueEvent } from "@/domain/events";
import { eventBus } from "@/infrastructure/events/event-bus";
import type { NextStepRepository } from "@/application/ports";

export interface OverdueDetectorResult {
  overdueCount: number;
  notifiedCount: number;
}

export class OverdueDetectorCron {
  constructor(private nextStepRepo: NextStepRepository) {}

  /**
   * Detecta next steps pendentes com dueDate < hoje.
   * Emite NextStepOverdueEvent para cada um (usado pelo dashboard para destacar).
   * NÃO muda o status — apenas sinaliza. O consultor decide o que fazer.
   */
  async execute(): Promise<OverdueDetectorResult> {
    const overdueSteps = await this.nextStepRepo.findOverdue();
    let notifiedCount = 0;

    for (const step of overdueSteps) {
      try {
        await eventBus.emit(
          new NextStepOverdueEvent(
            step.id,
            step.opportunityId,
            0, // personId resolvido pelo handler/repositório
            "", // personName resolvido pelo handler
            step.ownerId,
            step.dueDate
          )
        );
        notifiedCount++;
      } catch (err) {
        console.error(
          `[OverdueDetector] Erro ao notificar next step ${step.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    console.log(
      `[OverdueDetector] ${overdueSteps.length} next steps atrasados detectados, ` +
      `${notifiedCount} notificações emitidas.`
    );

    return {
      overdueCount: overdueSteps.length,
      notifiedCount,
    };
  }
}
