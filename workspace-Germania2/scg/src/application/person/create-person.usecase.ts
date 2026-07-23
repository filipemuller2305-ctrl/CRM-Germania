import { z } from "zod";
import { Person } from "@/domain/entities/person.entity";
import { PersonCreatedEvent } from "@/domain/events";
import { eventBus } from "@/infrastructure/events/event-bus";
import type { TransactionManager } from "../ports";

export const createPersonSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(["PF", "PJ"]).optional().default("PF"),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  document: z.string().optional().nullable(),
  relationshipOwnerId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export interface CreatePersonResult {
  success: boolean;
  personId?: number;
  error?: string;
  errorCode?: "VALIDATION" | "DUPLICATE" | "INTERNAL";
}

export class CreatePersonUseCase {
  constructor(private readonly transaction: TransactionManager) {}

  async execute(
    input: CreatePersonInput,
    actorId: number | null
  ): Promise<CreatePersonResult> {
    const parsed = createPersonSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((issue) => issue.message).join("; "),
        errorCode: "VALIDATION",
      };
    }

    try {
      const data = parsed.data;
      const saved = await this.transaction.run(async (repositories) => {
        if (data.document) {
          const document = data.document.replace(/\D/g, "");
          const existing = await repositories.person.findByDocument(document);
          if (existing) {
            throw new DuplicatePersonError(
              `Documento já cadastrado para ${existing.name} (ID ${existing.id})`
            );
          }
        }
        if (data.email) {
          const existing = await repositories.person.findByEmail(
            data.email.trim().toLowerCase()
          );
          if (existing) {
            throw new DuplicatePersonError(
              `E-mail já cadastrado para ${existing.name} (ID ${existing.id})`
            );
          }
        }

        const person = await repositories.person.create(Person.create(data));
        await repositories.timeline.add({
          personId: person.id,
          actorId,
          type: "person_created",
          title: "Pessoa cadastrada",
          description: `${person.name} foi cadastrado(a) no sistema.`,
          metadata: {
            relationshipOwnerId: person.relationshipOwnerId,
          },
        });
        return person;
      });

      await eventBus.emit(
        new PersonCreatedEvent(saved.id, saved.name, actorId)
      );
      return { success: true, personId: saved.id };
    } catch (error) {
      if (error instanceof DuplicatePersonError) {
        return {
          success: false,
          error: error.message,
          errorCode: "DUPLICATE",
        };
      }
      if (
        error instanceof Error &&
        [
          "PersonValidationError",
          "CpfCnpjInvalidError",
          "PhoneInvalidError",
        ].includes(error.name)
      ) {
        return {
          success: false,
          error: error.message,
          errorCode: "VALIDATION",
        };
      }
      return {
        success: false,
        error: "Erro interno ao criar pessoa",
        errorCode: "INTERNAL",
      };
    }
  }
}

class DuplicatePersonError extends Error {}
