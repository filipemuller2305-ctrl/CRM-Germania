import { db } from "@/db";
import { people, timelineEvents } from "@/db/schema";
import { getPeopleList } from "@/lib/queries";
import { eq, or } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const rows = await getPeopleList({ search, status });
  return Response.json(rows);
}

const createSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  document: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  ownerId: z.number().int().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Regra: nunca deverão existir cadastros duplicados (mesmo documento ou e-mail)
  if (data.document || data.email) {
    const conditions = [];
    if (data.document) conditions.push(eq(people.document, data.document));
    if (data.email) conditions.push(eq(people.email, data.email));
    const existing = await db
      .select()
      .from(people)
      .where(or(...conditions))
      .limit(1);
    if (existing.length > 0) {
      return Response.json(
        { error: { formErrors: [`Já existe uma pessoa cadastrada com este documento/e-mail: ${existing[0].name}`] } },
        { status: 409 },
      );
    }
  }

  const [created] = await db
    .insert(people)
    .values({
      name: data.name,
      phone: data.phone || null,
      whatsapp: data.whatsapp || null,
      email: data.email || null,
      document: data.document || null,
      origin: data.origin || null,
      ownerId: data.ownerId ?? null,
      status: data.status || "lead",
      notes: data.notes || null,
    })
    .returning();

  await db.insert(timelineEvents).values({
    personId: created.id,
    type: "person_created",
    title: "Pessoa cadastrada no SCG",
    description: `Origem: ${created.origin ?? "não informada"}`,
  });

  return Response.json(created, { status: 201 });
}
