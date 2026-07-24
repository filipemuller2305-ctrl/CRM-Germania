// ═══════════════════════════════════════════════════════════════════════════
// Server Actions: People
// CRUD de Pessoas + busca + workspace
// ═══════════════════════════════════════════════════════════════════════════

"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuth,
  getCurrentUserId,
  getUseCases,
  getRepositories,
  ok,
  fail,
  type ActionResponse,
} from "./helpers";
import { createPersonSchema, type CreatePersonInput } from "@/application/person/create-person.usecase";
import { z } from "zod";

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createPerson(
  formData: FormData
): Promise<ActionResponse<{ personId: number }>> {
  try {
    const actorId = await requireAuth();

    const input: CreatePersonInput = {
      name: formData.get("name") as string,
      type: (formData.get("type") as "PF" | "PJ") || "PF",
      phone: formData.get("phone") as string || null,
      whatsapp: formData.get("whatsapp") as string || null,
      email: formData.get("email") as string || null,
      document: formData.get("document") as string || null,
      relationshipOwnerId: formData.get("relationshipOwnerId")
        ? Number(formData.get("relationshipOwnerId"))
        : null,
      notes: formData.get("notes") as string || null,
    };

    const uc = getUseCases();
    const result = await uc.createPerson.execute(input, actorId);

    if (!result.success) {
      return fail(result.error!, result.errorCode);
    }

    revalidatePath("/pessoas");
    revalidatePath("/");
    return ok({ personId: result.personId! });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Erro ao criar pessoa",
      "INTERNAL"
    );
  }
}

// ─── CREATE (JSON — para modais com react-hook-form) ─────────────────────────

export async function createPersonJson(
  input: CreatePersonInput
): Promise<ActionResponse<{ personId: number }>> {
  try {
    const actorId = await requireAuth();
    const uc = getUseCases();
    const result = await uc.createPerson.execute(input, actorId);

    if (!result.success) {
      return fail(result.error!, result.errorCode);
    }

    revalidatePath("/pessoas");
    revalidatePath("/");
    return ok({ personId: result.personId! });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Erro ao criar pessoa",
      "INTERNAL"
    );
  }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

const updatePersonSchema = z.object({
  personId: z.number().int().positive(),
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  relationshipOwnerId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["ativa", "inativa"]).optional(),
});

export async function updatePerson(
  input: z.infer<typeof updatePersonSchema>
): Promise<ActionResponse> {
  try {
    await requireAuth();
    const repos = getRepositories();

    const person = await repos.person.findById(input.personId);
    if (!person) {
      return fail("Pessoa não encontrada", "NOT_FOUND");
    }

    // Aplica updates via entidade de domínio (valida internamente)
    person.update({
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      document: input.document,
      relationshipOwnerId: input.relationshipOwnerId,
      notes: input.notes,
    });

    // Atualiza status se fornecido
    if (input.status && input.status !== person.status) {
      switch (input.status) {
        case "ativa": person.reactivate(); break;
        case "inativa": person.deactivate(); break;
      }
    }

    await repos.person.update(person);

    // Timeline
    await repos.timeline.add({
      personId: person.id,
      actorId: await getCurrentUserId(),
      type: "person_updated",
      title: "Dados atualizados",
      description: "Informações cadastrais foram atualizadas.",
    });

    revalidatePath(`/pessoas/${input.personId}`);
    revalidatePath("/pessoas");
    return ok(undefined);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Erro ao atualizar pessoa",
      "INTERNAL"
    );
  }
}

// ─── LIST ────────────────────────────────────────────────────────────────────

export async function listPeople(params?: {
  status?: string;
  search?: string;
  relationshipOwnerId?: number;
  cursor?: number;
  limit?: number;
}): Promise<ActionResponse<{
  people: Array<{
    id: number;
    name: string;
    status: string;
    email: string | null;
    phone: string | null;
    createdAt: Date;
  }>;
  total: number;
  cursor: number | null;
  hasMore: boolean;
}>> {
  try {
    await requireAuth();
    const repos = getRepositories();

    const result = await repos.person.list({
      status: params?.status,
      search: params?.search,
      relationshipOwnerId: params?.relationshipOwnerId,
      pagination: {
        cursor: params?.cursor,
        limit: params?.limit ?? 20,
      },
    });

    return ok({
      people: result.data.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        email: p.email,
        phone: p.phone?.formatted ?? null,
        createdAt: p.createdAt,
      })),
      total: result.total,
      cursor: result.cursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    return fail("Erro ao listar pessoas", "INTERNAL");
  }
}

// ─── GET PERSON WORKSPACE (dados completos) ──────────────────────────────────

export async function getPersonWorkspace(personId: number): Promise<ActionResponse<any>> {
  try {
    await requireAuth();
    const repos = getRepositories();

    const person = await repos.person.findById(personId);
    if (!person) {
      return fail("Pessoa não encontrada", "NOT_FOUND");
    }

    // Carrega todos os dados do workspace em paralelo
    const [
      opportunities,
      leads,
      products,
      timeline,
      activities,
      crossSell,
      csStages,
    ] = await Promise.all([
      repos.opportunity.findByPersonId(personId),
      repos.lead.findOpenByPersonId(personId),
      repos.personProduct.findByPersonId(personId),
      repos.timeline.findByPersonId(personId, { limit: 50 }),
      repos.activity.findByPersonId(personId, { limit: 20 }),
      repos.crossSell.findByPersonId(personId),
      repos.customerSuccess.findByPersonId(personId),
    ]);

    return ok({
      person: {
        id: person.id,
        name: person.name,
        type: person.type,
        phone: person.phone?.formatted ?? null,
        whatsapp: person.whatsapp?.formatted ?? null,
        email: person.email,
        document: person.document?.formatted ?? null,
        status: person.status,
        relationshipOwnerId: person.relationshipOwnerId,
        notes: person.notes,
        createdAt: person.createdAt,
      },
      opportunities: opportunities.map((o) => ({
        id: o.id,
        productTypeId: o.productTypeId,
        status: o.status,
        estimatedValue: o.estimatedValue?.formatted ?? null,
        probability: o.probability,
        stageId: o.stageId,
        createdAt: o.createdAt,
        lastMovementAt: o.lastMovementAt,
      })),
      leads: leads.map((lead) => ({
        id: lead.id,
        status: lead.status,
        source: lead.source,
        channel: lead.channel,
        campaign: lead.campaign,
        productTypeId: lead.productTypeId,
        ownerId: lead.ownerId,
        createdAt: lead.createdAt,
      })),
      products: products.map((p) => ({
        id: p.id,
        productTypeId: p.productTypeId,
        status: p.status,
        policyNumber: p.policyNumber,
        insurer: p.insurer,
        renewalDate: p.renewalDate,
        premiumValue: p.premiumValue?.formatted ?? null,
        isRenewalApproaching: p.isRenewalApproaching,
      })),
      timeline: timeline.data,
      activities: activities.data.map((a) => ({
        id: a.id,
        type: a.type,
        description: a.description,
        createdAt: a.createdAt,
      })),
      crossSell: crossSell,
      customerSuccess: csStages.map((cs) => ({
        id: cs.id,
        stage: cs.stage,
        status: cs.status,
        dueDate: cs.dueDate,
        completedAt: cs.completedAt,
        isOverdue: cs.isOverdue,
      })),
    });
  } catch (error) {
    return fail("Erro ao carregar workspace", "INTERNAL");
  }
}
