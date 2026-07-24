// ═══════════════════════════════════════════════════════════════════════════
// Use Case: Convert Lead
// Converte um Lead qualificado em exatamente uma Oportunidade.
// Toda a operação deve rodar na mesma transação de banco.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { NextStep } from "@/domain/entities/next-step.entity";
import { Opportunity } from "@/domain/entities/opportunity.entity";
import { OpportunityType } from "@/domain/types";
import type { PipelineRepository, TransactionManager } from "../ports";

export const convertLeadSchema = z.object({
  leadId: z.number().int().positive(),
  pipelineId: z.number().int().positive(),
  initialStageId: z.number().int().positive(),
  ownerId: z.number().int().positive(),
  createdById: z.number().int().positive().nullable(),
  estimatedValue: z.union([z.number(), z.string()]).optional().nullable(),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional().nullable(),
  nextStep: z.object({
    description: z.string().min(3),
    dueDate: z.string().min(1),
    dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    objective: z.string().optional().nullable(),
  }),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

export interface ConvertLeadResult {
  success: boolean;
  opportunityId?: number;
  nextStepId?: number;
  error?: string;
  errorCode?: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "INTERNAL";
}

export class ConvertLeadUseCase {
  constructor(
    private transaction: TransactionManager,
    private pipelineRepo: PipelineRepository
  ) {}

  async execute(input: ConvertLeadInput): Promise<ConvertLeadResult> {
    const parsed = convertLeadSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((issue) => issue.message).join("; "),
        errorCode: "VALIDATION",
      };
    }

    try {
      const stage = await this.pipelineRepo.getStageById(
        parsed.data.initialStageId
      );
      if (
        !stage ||
        stage.pipelineId !== parsed.data.pipelineId ||
        stage.kind !== "open"
      ) {
        return {
          success: false,
          error: "A etapa inicial precisa ser aberta e pertencer ao pipeline",
          errorCode: "VALIDATION",
        };
      }

      const converted = await this.transaction.run(async (repositories) => {
        const lead = await repositories.lead.findById(parsed.data.leadId);
        if (!lead) {
          throw new LeadConversionError("NOT_FOUND", "Lead não encontrado");
        }
        if (!lead.isOpen) {
          throw new LeadConversionError(
            "CONFLICT",
            `Lead ${lead.status} não pode ser convertido`
          );
        }
        if (!lead.productTypeId) {
          throw new LeadConversionError(
            "VALIDATION",
            "Defina o produto de interesse antes da conversão"
          );
        }

        // Defesa em profundidade. O banco também deve ter UNIQUE(lead_id).
        const existingOpportunity =
          await repositories.opportunity.findByLeadId(lead.id);
        if (existingOpportunity) {
          throw new LeadConversionError(
            "CONFLICT",
            "Este Lead já possui uma Oportunidade"
          );
        }

        lead.reassign(parsed.data.ownerId);
        const opportunity = Opportunity.create({
          personId: lead.personId,
          leadId: lead.id,
          productTypeId: lead.productTypeId,
          pipelineId: parsed.data.pipelineId,
          stageId: parsed.data.initialStageId,
          ownerId: parsed.data.ownerId,
          createdById: parsed.data.createdById,
          type: OpportunityType.NOVO_NEGOCIO,
          attribution: lead.toAttributionSnapshot(),
          estimatedValue: parsed.data.estimatedValue,
          probability: parsed.data.probability,
          notes: parsed.data.notes,
        });

        const savedOpportunity =
          await repositories.opportunity.create(opportunity);

        const nextStep = NextStep.create({
          opportunityId: savedOpportunity.id,
          ownerId: parsed.data.ownerId,
          description: parsed.data.nextStep.description,
          dueDate: parsed.data.nextStep.dueDate,
          dueTime: parsed.data.nextStep.dueTime,
          objective: parsed.data.nextStep.objective,
        });
        const savedNextStep = await repositories.nextStep.create(nextStep);

        lead.convert(savedOpportunity.id);
        await repositories.lead.update(lead);

        await repositories.timeline.add({
          personId: lead.personId,
          leadId: lead.id,
          opportunityId: savedOpportunity.id,
          actorId: parsed.data.createdById,
          type: "lead_converted",
          title: "Lead convertido",
          description:
            "Contato qualificado e convertido em Oportunidade após intenção comercial real.",
          metadata: {
            source: lead.source,
            channel: lead.channel,
            campaign: lead.campaign,
            productTypeId: lead.productTypeId,
          },
        });

        await repositories.timeline.add({
          personId: lead.personId,
          opportunityId: savedOpportunity.id,
          actorId: parsed.data.createdById,
          type: "next_step_created",
          title: "Primeiro próximo passo definido",
          description: savedNextStep.description,
          metadata: {
            dueDate: savedNextStep.dueDate.toISOString().slice(0, 10),
            dueTime: savedNextStep.dueTime,
          },
        });

        return {
          opportunityId: savedOpportunity.id,
          nextStepId: savedNextStep.id,
        };
      });

      return { success: true, ...converted };
    } catch (error) {
      if (error instanceof LeadConversionError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
        };
      }
      if (
        error instanceof Error &&
        (error.name === "LeadValidationError" ||
          error.name === "OpportunityValidationError")
      ) {
        return {
          success: false,
          error: error.message,
          errorCode: "VALIDATION",
        };
      }
      return {
        success: false,
        error: "Erro interno ao converter Lead",
        errorCode: "INTERNAL",
      };
    }
  }
}

class LeadConversionError extends Error {
  constructor(
    readonly code: "VALIDATION" | "NOT_FOUND" | "CONFLICT",
    message: string
  ) {
    super(message);
    this.name = "LeadConversionError";
  }
}
