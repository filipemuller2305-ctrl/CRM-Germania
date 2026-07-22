import { db } from "@/db";
import { activities, nextSteps, timelineEvents, opportunities } from "@/db/schema";
import { getPersonActivities } from "@/lib/queries";
import { activityTypeLabels } from "@/lib/labels";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await getPersonActivities(Number(id));
  return Response.json(rows);
}

const schema = z.object({
  type: z.enum(["ligacao", "whatsapp", "email", "reuniao", "visita", "mensagem", "anotacao"]),
  description: z.string().optional().nullable(),
  ownerId: z.number().int().optional().nullable(),
  opportunityId: z.number().int().optional().nullable(),
  completeNextStepId: z.number().int().optional().nullable(),
  newNextStep: z
    .object({
      description: z.string().min(2),
      ownerId: z.number().int().optional().nullable(),
      dueDate: z.string().min(8),
      dueTime: z.string().optional().nullable(),
      objective: z.string().optional().nullable(),
      opportunityId: z.number().int(),
    })
    .optional()
    .nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const [activity] = await db
    .insert(activities)
    .values({
      personId,
      opportunityId: data.opportunityId ?? null,
      type: data.type,
      description: data.description || null,
      ownerId: data.ownerId ?? null,
    })
    .returning();

  await db.insert(timelineEvents).values({
    personId,
    opportunityId: data.opportunityId ?? null,
    type: data.type,
    title: `${activityTypeLabels[data.type] ?? "Atividade"} registrada`,
    description: data.description || null,
  });

  if (data.completeNextStepId) {
    const [completed] = await db
      .update(nextSteps)
      .set({ status: "concluido", completedAt: new Date() })
      .where(and(eq(nextSteps.id, data.completeNextStepId), eq(nextSteps.personId, personId)))
      .returning();
    if (completed) {
      await db.insert(timelineEvents).values({
        personId,
        opportunityId: completed.opportunityId,
        type: "next_step_done",
        title: "Próximo passo concluído",
        description: completed.description,
      });
    }
  }

  if (data.newNextStep) {
    const ns = data.newNextStep;
    // Garante que só existe um próximo passo pendente por oportunidade
    await db
      .update(nextSteps)
      .set({ status: "cancelado" })
      .where(and(eq(nextSteps.opportunityId, ns.opportunityId), eq(nextSteps.status, "pendente")));

    const [created] = await db
      .insert(nextSteps)
      .values({
        opportunityId: ns.opportunityId,
        personId,
        description: ns.description,
        ownerId: ns.ownerId ?? null,
        dueDate: ns.dueDate,
        dueTime: ns.dueTime || null,
        objective: ns.objective || null,
      })
      .returning();

    await db
      .update(opportunities)
      .set({ lastMovementAt: new Date() })
      .where(eq(opportunities.id, ns.opportunityId));

    await db.insert(timelineEvents).values({
      personId,
      opportunityId: ns.opportunityId,
      type: "next_step_created",
      title: "Próximo passo definido",
      description: `${created.description} — ${created.dueDate}${created.dueTime ? " " + created.dueTime : ""}`,
    });
  }

  return Response.json(activity, { status: 201 });
}
