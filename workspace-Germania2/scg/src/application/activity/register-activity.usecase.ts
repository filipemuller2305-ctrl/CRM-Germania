// ═══════════════════════════════════════════════════════════════════════════
// Use Case: Register Activity
// Registra uma atividade e opcionalmente gera um novo Próximo Passo (INV-07)
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { Activity } from "@/domain/entities/activity.entity";
import { NextStep } from "@/domain/entities/next-step.entity";
import { ActivityRegisteredEvent, NextStepCreatedEvent } from "@/domain/events";
import { eventBus } from "@/infrastructure/events/event-bus";
import { ActivityType } from "@/domain/types";
import type {
  ActivityRepository,
  NextStepRepository,
  OpportunityRepository,
  TimelineRepository,
} from "../ports";

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

export const registerActivitySchema = z.object({
  personId: z.number().int().positive("Pessoa é obrigatória"),
  opportunityId: z.number().int().positive().optional().nullable(),
  type: z.nativeEnum(ActivityType, { message: "Tipo de atividade inválido" }),
  description: z.string().max(5000).optional().nullable(),

  // INV-07: Opcionalmente gera um próximo passo
  generateNextStep: z.object({
    enabled: z.boolean().default(false),
    description: z.string().min(3).optional(),
    dueDate: z.string().optional(), // YYYY-MM-DD
    dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    objective: z.string().optional().nullable(),
  }).optional().default({ enabled: false }),
});

export type RegisterActivityInput = z.infer<typeof registerActivitySchema>;

// ─── RESULT ──────────────────────────────────────────────────────────────────

export interface RegisterActivityResult {
  success: boolean;
  activityId?: number;
  nextStepId?: number;
  error?: string;
  errorCode?: "VALIDATION" | "NOT_FOUND" | "INTERNAL";
}

// ─── USE CASE ────────────────────────────────────────────────────────────────

export class RegisterActivityUseCase {
  constructor(
    private activityRepo: ActivityRepository,
    private nextStepRepo: NextStepRepository,
    private opportunityRepo: OpportunityRepository,
    private timelineRepo: TimelineRepository
  ) {}

  async execute(input: RegisterActivityInput, actorId: number | null): Promise<RegisterActivityResult> {
    try {
      // 1. Validação
      const parsed = registerActivitySchema.safeParse(input);
      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
          errorCode: "VALIDATION",
        };
      }

      const data = parsed.data;

      // 2. Se vinculada a oportunidade, verifica se existe e está aberta
      if (data.opportunityId) {
        const opp = await this.opportunityRepo.findById(data.opportunityId);
        if (!opp) {
          return {
            success: false,
            error: `Oportunidade ${data.opportunityId} não encontrada`,
            errorCode: "NOT_FOUND",
          };
        }
      }

      // 3. Cria atividade
      const activity = Activity.create({
        personId: data.personId,
        opportunityId: data.opportunityId,
        ownerId: actorId,
        type: data.type,
        description: data.description,
      });

      const savedActivity = await this.activityRepo.create(activity);

      // 4. Registra na timeline
      const typeLabels: Record<string, string> = {
        ligacao: "Ligação realizada",
        whatsapp: "WhatsApp enviado",
        email: "E-mail enviado",
        reuniao: "Reunião realizada",
        visita: "Visita realizada",
        mensagem: "Mensagem enviada",
        anotacao: "Anotação registrada",
      };

      await this.timelineRepo.add({
        personId: data.personId,
        opportunityId: data.opportunityId,
        actorId,
        type: data.type,
        title: typeLabels[data.type] ?? "Atividade registrada",
        description: data.description,
      });

      // 5. INV-07: Gera próximo passo se solicitado
      let savedNextStepId: number | undefined;

      if (data.generateNextStep.enabled && data.opportunityId) {
        if (!data.generateNextStep.description || !data.generateNextStep.dueDate) {
          return {
            success: false,
            error: "Para gerar um próximo passo, descrição e data são obrigatórios",
            errorCode: "VALIDATION",
          };
        }

        const nextStep = NextStep.create({
          opportunityId: data.opportunityId,
          ownerId: actorId,
          description: data.generateNextStep.description,
          dueDate: data.generateNextStep.dueDate,
          dueTime: data.generateNextStep.dueTime,
          objective: data.generateNextStep.objective,
        });

        const savedNextStep = await this.nextStepRepo.create(nextStep);
        savedNextStepId = savedNextStep.id;

        // Timeline do next step
        await this.timelineRepo.add({
          personId: data.personId,
          opportunityId: data.opportunityId,
          actorId,
          type: "next_step_created",
          title: "Próximo passo definido",
          description: `${savedNextStep.description} (gerado a partir de atividade: ${typeLabels[data.type]})`,
          metadata: {
            dueDate: savedNextStep.dueDate.toISOString().split("T")[0],
            generatedFromActivity: savedActivity.id,
          },
        });

        // Evento do next step
        await eventBus.emit(
          new NextStepCreatedEvent(
            savedNextStep.id,
            data.opportunityId,
            data.personId,
            savedNextStep.dueDate,
            savedNextStep.description,
            actorId
          )
        );
      }

      // 6. Emite evento da atividade
      await eventBus.emit(
        new ActivityRegisteredEvent(
          savedActivity.id,
          data.personId,
          data.opportunityId,
          data.type,
          data.description,
          actorId
        )
      );

      return {
        success: true,
        activityId: savedActivity.id,
        nextStepId: savedNextStepId,
      };
    } catch (error) {
      if (error instanceof Error && (
        error.name === "ActivityValidationError" ||
        error.name === "NextStepValidationError"
      )) {
        return { success: false, error: error.message, errorCode: "VALIDATION" };
      }
      console.error("[RegisterActivityUseCase] Erro inesperado:", error);
      return { success: false, error: "Erro interno ao registrar atividade", errorCode: "INTERNAL" };
    }
  }
}
