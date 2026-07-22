import { db } from "@/db";
import { customerSuccessStages, timelineEvents } from "@/db/schema";
import { customerSuccessStageLabels } from "@/lib/labels";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["pendente", "concluido", "cancelado"]),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(customerSuccessStages)
    .set({
      status: parsed.data.status,
      notes: parsed.data.notes,
      completedAt: parsed.data.status === "concluido" ? new Date() : null,
    })
    .where(eq(customerSuccessStages.id, Number(id)))
    .returning();

  if (!updated) return Response.json({ error: "Etapa não encontrada" }, { status: 404 });

  await db.insert(timelineEvents).values({
    personId: updated.personId,
    opportunityId: updated.opportunityId,
    type: "customer_success",
    title: `Customer Success: ${customerSuccessStageLabels[updated.stage] ?? updated.stage}`,
    description: parsed.data.status === "concluido" ? "Etapa concluída." : `Status: ${parsed.data.status}`,
  });

  return Response.json(updated);
}
