import { db } from "@/db";
import { opportunities, nextSteps, timelineEvents, pipelineStages, people } from "@/db/schema";
import { getOpportunitiesBoard } from "@/lib/queries";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pipelineId = Number(searchParams.get("pipelineId") ?? 1);
  const rows = await getOpportunitiesBoard(pipelineId);
  return Response.json(rows);
}

const schema = z.object({
  personId: z.number().int(),
  product: z.string().min(1),
  pipelineId: z.number().int(),
  stageId: z.number().int(),
  ownerId: z.number().int().optional().nullable(),
  estimatedValue: z.number().optional().nullable(),
  probability: z.number().int().min(0).max(100).optional(),
  origin: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  nextStep: z.object({
    description: z.string().min(2),
    ownerId: z.number().int().optional().nullable(),
    dueDate: z.string().min(8),
    dueTime: z.string().optional().nullable(),
    objective: z.string().optional().nullable(),
  }),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const [opportunity] = await db
    .insert(opportunities)
    .values({
      personId: data.personId,
      product: data.product,
      pipelineId: data.pipelineId,
      stageId: data.stageId,
      ownerId: data.ownerId ?? null,
      estimatedValue: data.estimatedValue != null ? String(data.estimatedValue) : null,
      probability: data.probability ?? 50,
      origin: data.origin || null,
      notes: data.notes || null,
    })
    .returning();

  const [nextStep] = await db
    .insert(nextSteps)
    .values({
      opportunityId: opportunity.id,
      personId: data.personId,
      description: data.nextStep.description,
      ownerId: data.nextStep.ownerId ?? data.ownerId ?? null,
      dueDate: data.nextStep.dueDate,
      dueTime: data.nextStep.dueTime || null,
      objective: data.nextStep.objective || null,
    })
    .returning();

  const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, data.stageId)).limit(1);

  // Se a pessoa ainda é lead, promove para "ativo" ao abrir oportunidade
  await db
    .update(people)
    .set({ status: "ativo" })
    .where(eq(people.id, data.personId));

  await db.insert(timelineEvents).values([
    {
      personId: data.personId,
      opportunityId: opportunity.id,
      type: "opportunity_created",
      title: "Oportunidade criada",
      description: `${data.product} — etapa "${stage?.name ?? ""}"`,
    },
    {
      personId: data.personId,
      opportunityId: opportunity.id,
      type: "next_step_created",
      title: "Próximo passo definido",
      description: `${nextStep.description} — ${nextStep.dueDate}${nextStep.dueTime ? " " + nextStep.dueTime : ""}`,
    },
  ]);

  return Response.json(opportunity, { status: 201 });
}
