import { db } from "@/db";
import { opportunities, nextSteps, timelineEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  completeCurrentId: z.number().int().optional().nullable(),
  newNextStep: z
    .object({
      description: z.string().min(2),
      ownerId: z.number().int().optional().nullable(),
      dueDate: z.string().min(8),
      dueTime: z.string().optional().nullable(),
      objective: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunityId = Number(id);
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (!opportunity) return Response.json({ error: "Oportunidade não encontrada" }, { status: 404 });

  if (opportunity.status === "aberta" && !data.newNextStep) {
    return Response.json(
      { error: { formErrors: ["Toda oportunidade aberta precisa de um próximo passo. Defina o novo próximo passo."] } },
      { status: 400 },
    );
  }

  if (data.completeCurrentId) {
    const [completed] = await db
      .update(nextSteps)
      .set({ status: "concluido", completedAt: new Date() })
      .where(and(eq(nextSteps.id, data.completeCurrentId), eq(nextSteps.opportunityId, opportunityId)))
      .returning();
    if (completed) {
      await db.insert(timelineEvents).values({
        personId: opportunity.personId,
        opportunityId,
        type: "next_step_done",
        title: "Próximo passo concluído",
        description: completed.description,
      });
    }
  }

  if (data.newNextStep) {
    await db
      .update(nextSteps)
      .set({ status: "cancelado" })
      .where(and(eq(nextSteps.opportunityId, opportunityId), eq(nextSteps.status, "pendente")));

    const [created] = await db
      .insert(nextSteps)
      .values({
        opportunityId,
        personId: opportunity.personId,
        description: data.newNextStep.description,
        ownerId: data.newNextStep.ownerId ?? opportunity.ownerId,
        dueDate: data.newNextStep.dueDate,
        dueTime: data.newNextStep.dueTime || null,
        objective: data.newNextStep.objective || null,
      })
      .returning();

    await db
      .update(opportunities)
      .set({ lastMovementAt: new Date() })
      .where(eq(opportunities.id, opportunityId));

    await db.insert(timelineEvents).values({
      personId: opportunity.personId,
      opportunityId,
      type: "next_step_created",
      title: "Próximo passo definido",
      description: `${created.description} — ${created.dueDate}${created.dueTime ? " " + created.dueTime : ""}`,
    });
  }

  return Response.json({ ok: true });
}
