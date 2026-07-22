import { db } from "@/db";
import { documents, timelineEvents } from "@/db/schema";
import { getPersonDocuments } from "@/lib/queries";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await getPersonDocuments(Number(id));
  return Response.json(rows);
}

const schema = z.object({
  name: z.string().min(1),
  type: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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

  const [doc] = await db
    .insert(documents)
    .values({ personId, name: data.name, type: data.type || null, url: data.url || null, notes: data.notes || null })
    .returning();

  await db.insert(timelineEvents).values({
    personId,
    type: "document_added",
    title: "Documento adicionado",
    description: data.name,
  });

  return Response.json(doc, { status: 201 });
}
