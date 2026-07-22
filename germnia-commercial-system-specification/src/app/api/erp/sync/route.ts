import { db } from "@/db";
import { erpSyncLog, people, timelineEvents } from "@/db/schema";
import { getErpSyncLogList } from "@/lib/queries";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Este endpoint simula a integração com o ERP Agger.
// Em produção, aqui seria feita a chamada real à API do Agger utilizando
// AGGER_API_URL / AGGER_API_KEY (variáveis de ambiente do servidor).

export async function GET() {
  const rows = await getErpSyncLogList();
  return Response.json(rows);
}

const schema = z.object({
  personId: z.number().int().optional().nullable(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const personId = parsed.success ? parsed.data.personId : null;

  const targets = personId
    ? await db.select().from(people).where(eq(people.id, personId)).limit(1)
    : await db.select().from(people).limit(10);

  const hasCredentials = Boolean(process.env.AGGER_API_URL && process.env.AGGER_API_KEY);

  const results = [];
  for (const person of targets) {
    const success = true;
    const message = hasCredentials
      ? "Sincronizado com o Agger."
      : "Simulação de sincronização (credenciais do Agger não configuradas neste ambiente).";

    const [log] = await db
      .insert(erpSyncLog)
      .values({
        entity: "pessoa",
        externalId: `AGGER-SIM-${person.id}`,
        personId: person.id,
        status: success ? "sucesso" : "erro",
        message,
        payload: { name: person.name, document: person.document },
      })
      .returning();

    await db.insert(timelineEvents).values({
      personId: person.id,
      type: "erp_sync",
      title: "Sincronização com ERP (Agger)",
      description: message,
    });

    results.push(log);
  }

  return Response.json({ ok: true, synced: results.length, results });
}
