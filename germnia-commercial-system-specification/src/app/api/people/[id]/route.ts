import { db } from "@/db";
import { people, timelineEvents } from "@/db/schema";
import { getPersonById } from "@/lib/queries";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await getPersonById(Number(id));
  if (!person) return Response.json({ error: "Pessoa não encontrada" }, { status: 404 });
  return Response.json(person);
}

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  ownerId: z.number().int().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const before = await getPersonById(personId);
  if (!before) return Response.json({ error: "Pessoa não encontrada" }, { status: 404 });

  const [updated] = await db
    .update(people)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(people.id, personId))
    .returning();

  if (parsed.data.status && parsed.data.status !== before.status) {
    await db.insert(timelineEvents).values({
      personId,
      type: "anotacao",
      title: "Status atualizado",
      description: `Status alterado para "${parsed.data.status}".`,
    });
  } else {
    await db.insert(timelineEvents).values({
      personId,
      type: "anotacao",
      title: "Dados cadastrais atualizados",
      description: "Informações de cadastro foram atualizadas.",
    });
  }

  return Response.json(updated);
}
