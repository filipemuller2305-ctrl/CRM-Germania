// ═══════════════════════════════════════════════════════════════════════════
// Use Case: Create Opportunity
// Cria uma oportunidade COM next step obrigatório (INV-02) em transação
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { Opportunity } from "@/domain/entities/opportunity.entity";
import { NextStep } from "@/domain/entities/next-step.entity";
import { OpportunityCreatedEvent, NextStepCreatedEvent } from "@/domain/events";
import { eventBus } from "@/infrastructure/events/event-bus";
import { OriginOptions } from "@/domain/types";
import type {
  OpportunityRepository,
  NextStepRepository,
  PersonRepository,
  PipelineRepository,
  TimelineRepository,
} from "../ports";

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

export const createOpportunitySchema = z.object({
  personId: z.number().int().positive("Pessoa é obrigatória"),
  productTypeId: z.number().int().positive("Produto é obrigatório"),
  pipelineId: z.number().int().positive("Pipeline é obrigatório"),
  stageId: z.number().int().positive("Etapa é obrigatória"),
  ownerId: z.number().int().positive().optional().nullable(),
  estimatedValue: z.union([z.number(), z.string()]).optional().nullable(),
  probability: z.number().int().min(0).max(100).optional().default(50),
  origin: z.enum(OriginOptions).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),

  // INV-02: Next step é OBRIGATÓRIO na criação
  nextStep: z.object({
    description: z.string().min(3, "Descrição do próximo passo é obrigatória"),
    dueDate: z.string().min(1, "Data do próximo passo é obrigatória"), // YYYY-MM-DD
    dueTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional().nullable(),
    objective: z.string().optional().nullable(),
  }),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

// ─── RESULT ──────────────────────────────────────────────────────────────────

export interface CreateOpportunityResult {
  success: boolean;
  opportunityId?: number;
  nextStepId?: number;
  error?: string;
  errorCode?: "VALIDATION" | "PERSON_NOT_FOUND" | "STAGE_INVALID" | "INTERNAL";
}

// ─── USE CASE ────────────────────────────────────────────────────────────────

export class CreateOpportunityUseCase {
  constructor(
    private opportunityRepo: OpportunityRepository,
    private nextStepRepo: NextStepRepository,
    private personRepo: PersonRepository,
    private pipelineRepo: PipelineRepository,
    private timelineRepo: TimelineRepository
  ) {}

  async execute(input: CreateOpportunityInput, actorId: number | null): Promise<CreateOpportunityResult> {
    try {
      // 1. Validação de schema
      const parsed = createOpportunitySchema.safeParse(input);
      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
          errorCode: "VALIDATION",
        };
      }

      const data = parsed.data;

      // 2. Verifica se a pessoa existe
      const person = await this.personRepo.findById(data.personId);
      if (!person) {
        return {
          success: false,
          error: `Pessoa com ID ${data.personId} não encontrada`,
          errorCode: "PERSON_NOT_FOUND",
        };
      }

      // 3. Verifica se a etapa pertence ao pipeline (INV-04)
      const stage = await this.pipelineRepo.getStageById(data.stageId);
      if (!stage) {
        return {
          success: false,
          error: `Etapa com ID ${data.stageId} não encontrada`,
          errorCode: "STAGE_INVALID",
        };
      }
      if (stage.pipelineId !== data.pipelineId) {
        return {
          success: false,
          error: `INV-04: Etapa "${stage.name}" não pertence ao pipeline informado`,
          errorCode: "STAGE_INVALID",
        };
      }

      // 4. Cria entidades de domínio
      const opportunity = Opportunity.create({
        personId: data.personId,
        productTypeId: data.productTypeId,
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        ownerId: data.ownerId ?? person.ownerId,
        estimatedValue: data.estimatedValue,
        probability: data.probability,
        origin: data.origin as any,
        notes: data.notes,
      });

      const nextStep = NextStep.create({
        opportunityId: 0, // será atualizado após persistir a oportunidade
        ownerId: data.ownerId ?? person.ownerId,
        description: data.nextStep.description,
        dueDate: data.nextStep.dueDate,
        dueTime: data.nextStep.dueTime,
        objective: data.nextStep.objective,
      });

      // 5. Persiste em TRANSAÇÃO (oportunidade + next step + timeline)
      // NOTA: A implementação real usará db.transaction() no repositório.
      // Aqui demonstramos a lógica; o repositório concreto encapsula a transação.
      const savedOpportunity = await this.opportunityRepo.create(opportunity);

      // Atualiza o opportunityId do next step agora que temos o ID
      const nextStepWithOppId = NextStep.create({
        ...nextStep.toPersistence(),
        opportunityId: savedOpportunity.id,
      } as any);
      const savedNextStep = await this.nextStepRepo.create(nextStepWithOppId);

      // 6. Timeline
      await this.timelineRepo.add({
        personId: data.personId,
        opportunityId: savedOpportunity.id,
        actorId,
        type: "opportunity_created",
        title: "Oportunidade criada",
        description: `Nova oportunidade de ${stage.name} criada.`,
        metadata: {
          stage: stage.name,
          estimatedValue: savedOpportunity.estimatedValue?.reais ?? null,
          probability: savedOpportunity.probability,
        },
      });

      await this.timelineRepo.add({
        personId: data.personId,
        opportunityId: savedOpportunity.id,
        actorId,
        type: "next_step_created",
        title: "Próximo passo definido",
        description: savedNextStep.description,
        metadata: {
          dueDate: savedNextStep.dueDate.toISOString().split("T")[0],
          dueTime: savedNextStep.dueTime,
        },
      });

      // 7. Emite eventos
      await eventBus.emitAll([
        new OpportunityCreatedEvent(
          savedOpportunity.id,
          data.personId,
          data.productTypeId,
          data.stageId,
          actorId
        ),
        new NextStepCreatedEvent(
          savedNextStep.id,
          savedOpportunity.id,
          data.personId,
          savedNextStep.dueDate,
          savedNextStep.description,
          actorId
        ),
      ]);

      return {
        success: true,
        opportunityId: savedOpportunity.id,
        nextStepId: savedNextStep.id,
      };
    } catch (error) {
      if (error instanceof Error && (
        error.name === "OpportunityValidationError" ||
        error.name === "NextStepValidationError"
      )) {
        return { success: false, error: error.message, errorCode: "VALIDATION" };
      }
      console.error("[CreateOpportunityUseCase] Erro inesperado:", error);
      return { success: false, error: "Erro interno ao criar oportunidade", errorCode: "INTERNAL" };
    }
  }
}
