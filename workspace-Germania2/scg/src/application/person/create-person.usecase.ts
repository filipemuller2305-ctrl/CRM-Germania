// ═══════════════════════════════════════════════════════════════════════════
// Use Case: Create Person
// Cria uma nova Pessoa com validações de domínio e deduplicação (INV-01)
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { Person } from "@/domain/entities/person.entity";
import { PersonCreatedEvent } from "@/domain/events";
import { eventBus } from "@/infrastructure/events/event-bus";
import { OriginOptions } from "@/domain/types";
import type { PersonRepository, TimelineRepository } from "../ports";

// ─── SCHEMA (validação de entrada) ──────────────────────────────────────────

export const createPersonSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(200, "Nome muito longo"),
  type: z.enum(["PF", "PJ"]).optional().default("PF"),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").optional().nullable().or(z.literal("")),
  document: z.string().optional().nullable(),
  origin: z.enum(OriginOptions).optional().nullable(),
  ownerId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

// ─── RESULT ──────────────────────────────────────────────────────────────────

export interface CreatePersonResult {
  success: boolean;
  personId?: number;
  error?: string;
  errorCode?: "VALIDATION" | "DUPLICATE" | "INTERNAL";
}

// ─── USE CASE ────────────────────────────────────────────────────────────────

export class CreatePersonUseCase {
  constructor(
    private personRepo: PersonRepository,
    private timelineRepo: TimelineRepository
  ) {}

  async execute(input: CreatePersonInput, actorId: number | null): Promise<CreatePersonResult> {
    try {
      // 1. Validação de schema
      const parsed = createPersonSchema.safeParse(input);
      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error.errors.map((e) => e.message).join("; "),
          errorCode: "VALIDATION",
        };
      }

      const data = parsed.data;

      // 2. Verificação de duplicidade (INV-01)
      if (data.document) {
        const normalizedDoc = data.document.replace(/\D/g, "");
        const existing = await this.personRepo.findByDocument(normalizedDoc);
        if (existing) {
          return {
            success: false,
            error: `Já existe uma pessoa com este documento (cadastrada em ${existing.createdAt.toLocaleDateString("pt-BR")}). ID: ${existing.id}`,
            errorCode: "DUPLICATE",
          };
        }
      }

      // 3. Verificação de e-mail duplicado (se fornecido)
      if (data.email && data.email.trim() !== "") {
        const existingByEmail = await this.personRepo.findByEmail(data.email.trim().toLowerCase());
        if (existingByEmail) {
          return {
            success: false,
            error: `Já existe uma pessoa com este e-mail: ${existingByEmail.name} (ID: ${existingByEmail.id})`,
            errorCode: "DUPLICATE",
          };
        }
      }

      // 4. Cria entidade de domínio (valida internamente)
      const person = Person.create({
        name: data.name,
        type: data.type,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        document: data.document,
        origin: data.origin as any,
        ownerId: data.ownerId,
        notes: data.notes,
      });

      // 5. Persiste
      const saved = await this.personRepo.create(person);

      // 6. Registra na timeline (INV-03: imutável)
      await this.timelineRepo.add({
        personId: saved.id,
        actorId,
        type: "person_created",
        title: "Pessoa cadastrada",
        description: `${saved.name} foi cadastrado(a) no sistema.`,
        metadata: {
          origin: saved.origin,
          owner: saved.ownerId,
        },
      });

      // 7. Emite evento de domínio
      await eventBus.emit(
        new PersonCreatedEvent(
          saved.id,
          saved.name,
          saved.origin,
          actorId
        )
      );

      return { success: true, personId: saved.id };
    } catch (error) {
      if (error instanceof Error && error.name === "PersonValidationError") {
        return { success: false, error: error.message, errorCode: "VALIDATION" };
      }
      if (error instanceof Error && (error.name === "CpfCnpjInvalidError" || error.name === "PhoneInvalidError")) {
        return { success: false, error: error.message, errorCode: "VALIDATION" };
      }
      console.error("[CreatePersonUseCase] Erro inesperado:", error);
      return { success: false, error: "Erro interno ao criar pessoa", errorCode: "INTERNAL" };
    }
  }
}
