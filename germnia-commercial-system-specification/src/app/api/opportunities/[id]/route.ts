import { db } from "@/db";
import { opportunities, timelineEvents } from "@/db/schema";
import { getOpportunityById } from "@/lib/queries";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getOpportunityById(Number(id));
  if (!row) return Response.json({ error: "Oportunidade não encontrada" }, { status: 404 });
  return Response.json(row);
}

const schema = z.object({
  product: z.string().optional(),
  ownerId: z.number().int().optional().nullable(),
  estimatedValue: z.number().optional().nullable(),
  probability: z.number().int().min(0).max(100).optional(),
  origin: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunityId = Number(id);
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const [updated] = await db
    .update(opportunities)
    .set({
      ...data,
      estimatedValue: data.estimatedValue != null ? String(data.estimatedValue) : undefined,
      lastMovementAt: new Date(),
    })
    .where(eq(opportunities.id, opportunityId))
    .returning();

  if (!updated) return Response.json({ error: "Oportunidade não encontrada" }, { status: 404 });

  await db.insert(timelineEvents).values({
    personId: updated.personId,
    opportunityId: updated.id,
    type: "anotacao",
    title: "Oportunidade atualizada",
    description: "Dados da oportunidade foram atualizados.",
  });

  return Response.json(updated);
}
