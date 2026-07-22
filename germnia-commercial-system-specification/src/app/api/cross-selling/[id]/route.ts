import { db } from "@/db";
import { crossSellSuggestions, timelineEvents, productTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["sugerida", "convertida", "descartada"]),
  opportunityId: z.number().int().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(crossSellSuggestions)
    .set({ status: parsed.data.status, opportunityId: parsed.data.opportunityId ?? null, updatedAt: new Date() })
    .where(eq(crossSellSuggestions.id, Number(id)))
    .returning();

  if (!updated) return Response.json({ error: "Sugestão não encontrada" }, { status: 404 });

  const [pt] = await db.select().from(productTypes).where(eq(productTypes.id, updated.productTypeId)).limit(1);

  await db.insert(timelineEvents).values({
    personId: updated.personId,
    opportunityId: updated.opportunityId,
    type: "cross_sell",
    title:
      parsed.data.status === "convertida"
        ? "Cross Selling convertido em oportunidade"
        : parsed.data.status === "descartada"
          ? "Cross Selling descartado"
          : "Cross Selling sugerido",
    description: `${pt?.name ?? "Produto"}`,
  });

  return Response.json(updated);
}
