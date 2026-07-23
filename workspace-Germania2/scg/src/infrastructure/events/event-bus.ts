// ═══════════════════════════════════════════════════════════════════════════
// Infrastructure: Event Bus
// Barramento de eventos em processo (in-memory).
// Permite que handlers reajam a eventos de domínio de forma desacoplada.
// ═══════════════════════════════════════════════════════════════════════════

import type { DomainEvent, EventMap, EventType } from "@/domain/events";

type EventHandler<T extends DomainEvent> = (event: T) => Promise<void> | void;

interface QueuedEvent {
  event: DomainEvent;
  eventType: string;
}

export class EventBus {
  private handlers = new Map<string, EventHandler<DomainEvent>[]>();
  private queue: QueuedEvent[] = [];
  private isProcessing = false;

  // ─── REGISTRO ────────────────────────────────────────────────────────────

  /**
   * Registra um handler para um tipo de evento.
   * Múltiplos handlers podem ser registrados para o mesmo evento.
   */
  on<K extends EventType>(
    eventType: K,
    handler: EventHandler<EventMap[K]>
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(eventType, existing);
  }

  /** Remove todos os handlers de um tipo de evento (útil para testes) */
  off(eventType: EventType): void {
    this.handlers.delete(eventType);
  }

  /** Remove todos os handlers (útil para testes) */
  clear(): void {
    this.handlers.clear();
    this.queue = [];
  }

  // ─── EMISSÃO ─────────────────────────────────────────────────────────────

  /**
   * Emite um evento. Os handlers são executados de forma assíncrona.
   * Se chamado dentro de outro handler, o evento é enfileirado.
   */
  async emit(event: DomainEvent): Promise<void> {
    this.queue.push({ event, eventType: event.eventType });

    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Emite múltiplos eventos em sequência.
   */
  async emitAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.queue.push({ event, eventType: event.eventType });
    }

    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  // ─── PROCESSAMENTO ───────────────────────────────────────────────────────

  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const { event, eventType } = this.queue.shift()!;
        const handlers = this.handlers.get(eventType) ?? [];

        for (const handler of handlers) {
          try {
            await handler(event);
          } catch (error) {
            // Log do erro mas não interrompe a cadeia de eventos
            console.error(
              `[EventBus] Erro no handler de "${eventType}":`,
              error instanceof Error ? error.message : error
            );
            // Em produção: enviar para Sentry/logging service
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // ─── UTILS ───────────────────────────────────────────────────────────────

  /** Quantos handlers registrados para um evento (debug/testes) */
  handlerCount(eventType: EventType): number {
    return this.handlers.get(eventType)?.length ?? 0;
  }

  /** Se há eventos na fila aguardando processamento */
  get hasPendingEvents(): boolean {
    return this.queue.length > 0;
  }
}

// ─── SINGLETON ─────────────────────────────────────────────────────────────────

/** Instância global do Event Bus (compartilhada em todo o processo) */
export const eventBus = new EventBus();
