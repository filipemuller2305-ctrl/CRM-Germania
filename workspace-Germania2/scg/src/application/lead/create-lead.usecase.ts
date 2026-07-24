import { z } from "zod";
import { Lead } from "@/domain/entities/lead.entity";
import { ContactSource, EntryChannel } from "@/domain/types";
import type { TransactionManager } from "../ports";

export const createLeadSchema = z.object({
  personId: z.number().int().positive(),
  productTypeId: z.number().int().positive().optional().nullable(),
  source: z.nativeEnum(ContactSource),
  channel: z.nativeEnum(EntryChannel),
  campaign: z.string().max(255).optional().nullable(),
  referredByPersonId: z.number().int().positive().optional().nullable(),
  sourceDetail: z.string().max(500).optional().nullable(),
  capturedById: z.number().int().positive(),
  ownerId: z.number().int().positive().optional().nullable(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export interface CreateLeadResult {
  success: boolean;
  leadId?: number;
  error?: string;
  errorCode?: "VALIDATION" | "PERSON_NOT_FOUND" | "INTERNAL";
}

export class CreateLeadUseCase {
  constructor(private readonly transaction: TransactionManager) {}

  async execute(input: CreateLeadInput): Promise<CreateLeadResult> {
    const parsed = createLeadSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((issue) => issue.message).join("; "),
        errorCode: "VALIDATION",
      };
    }

    try {
      const data = parsed.data;
      const leadId = await this.transaction.run(async (repositories) => {
        const person = await repositories.person.findById(data.personId);
        if (!person) throw new PersonNotFoundError(data.personId);
        if (data.referredByPersonId) {
          const referrer = await repositories.person.findById(
            data.referredByPersonId
          );
          if (!referrer) throw new PersonNotFoundError(data.referredByPersonId);
        }

        const saved = await repositories.lead.create(Lead.create(data));
        await repositories.timeline.add({
          personId: saved.personId,
          leadId: saved.id,
          actorId: saved.capturedById,
          type: "lead_created",
          title: "Lead recebido",
          description: `Entrada por ${saved.channel}, origem ${saved.source}.`,
          metadata: {
            source: saved.source,
            channel: saved.channel,
            campaign: saved.campaign,
            capturedById: saved.capturedById,
            ownerId: saved.ownerId,
          },
        });
        return saved.id;
      });
      return { success: true, leadId };
    } catch (error) {
      if (error instanceof PersonNotFoundError) {
        return {
          success: false,
          error: error.message,
          errorCode: "PERSON_NOT_FOUND",
        };
      }
      if (error instanceof Error && error.name === "LeadValidationError") {
        return {
          success: false,
          error: error.message,
          errorCode: "VALIDATION",
        };
      }
      return {
        success: false,
        error: "Erro interno ao criar Lead",
        errorCode: "INTERNAL",
      };
    }
  }
}

class PersonNotFoundError extends Error {
  constructor(personId: number) {
    super(`Pessoa ${personId} não encontrada`);
  }
}
