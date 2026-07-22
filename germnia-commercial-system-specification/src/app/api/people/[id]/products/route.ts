import { db } from "@/db";
import { personProducts, timelineEvents, productTypes } from "@/db/schema";
import { getPersonProductsList } from "@/lib/queries";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await getPersonProductsList(Number(id));
  return Response.json(rows);
}

const schema = z.object({
  productTypeId: z.number().int(),
  policyNumber: z.string().optional().nullable(),
  insurer: z.string().optional().nullable(),
  status: z.string().optional(),
  startDate: z.string().optional().nullable(),
  renewalDate: z.string().optional().nullable(),
  premiumValue: z.number().optional().nullable(),
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

  const [product] = await db
    .insert(personProducts)
    .values({
      personId,
      productTypeId: data.productTypeId,
      policyNumber: data.policyNumber || null,
      insurer: data.insurer || null,
      status: data.status || "ativa",
      startDate: data.startDate || null,
      renewalDate: data.renewalDate || null,
      premiumValue: data.premiumValue != null ? String(data.premiumValue) : null,
    })
    .returning();

  const [pt] = await db.select().from(productTypes).where(eq(productTypes.id, data.productTypeId)).limit(1);

  await db.insert(timelineEvents).values({
    personId,
    type: "product_added",
    title: "Produto adicionado",
    description: `${pt?.name ?? "Produto"} — ${data.insurer ?? "seguradora não informada"}`,
  });

  return Response.json(product, { status: 201 });
}
