import { db } from "@/db";
import { opportunities, pipelineStages, timelineEvents, nextSteps, customerSuccessStages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { customerSuccessStageOrder } from "@/lib/labels";

export const dynamic = "force-dynamic";

const schema = z.object({
  stageId: z.number().int(),
  lostReason: z.string().optional().nullable(),
});

const csStageOffsets: Record<string, number> = {
  boas_vindas: 0,
  confirmacao_apolice: 2,
  primeiro_contato: 7,
  pesquisa_satisfacao: 30,
  acompanhamento: 90,
  renovacao_futura: 330,
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunityId = Number(id);
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (!opportunity) return Response.json({ error: "Oportunidade não encontrada" }, { status: 404 });

  const [oldStage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, opportunity.stageId)).limit(1);
  const [newStage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, parsed.data.stageId)).limit(1);
  if (!newStage) return Response.json({ error: "Etapa inválida" }, { status: 400 });

  const isWon = newStage.kind === "won";
  const isLost = newStage.kind === "lost";

  const [updated] = await db
    .update(opportunities)
    .set({
      stageId: newStage.id,
      status: isWon ? "ganha" : isLost ? "perdida" : "aberta",
      lostReason: isLost ? parsed.data.lostReason ?? opportunity.lostReason : opportunity.lostReason,
      closedAt: isWon || isLost ? new Date() : null,
      lastMovementAt: new Date(),
    })
    .where(eq(opportunities.id, opportunityId))
    .returning();

  await db.insert(timelineEvents).values({
    personId: opportunity.personId,
    opportunityId: opportunity.id,
    type: isWon ? "closed_won" : isLost ? "closed_lost" : "stage_change",
    title: isWon
      ? "Oportunidade ganha"
      : isLost
        ? "Oportunidade perdida"
        : `Movida de "${oldStage?.name ?? "—"}" para "${newStage.name}"`,
    description: isLost ? parsed.data.lostReason ?? null : null,
  });

  if (isWon || isLost) {
    // Oportunidade fechada: cancela próximos passos pendentes (não é mais necessário manter aberto)
    await db
      .update(nextSteps)
      .set({ status: "cancelado" })
      .where(and(eq(nextSteps.opportunityId, opportunityId), eq(nextSteps.status, "pendente")));
  }

  if (isWon) {
    // Inicia automaticamente o Customer Success
    const today = new Date();
    const rows = customerSuccessStageOrder.map((stage) => {
      const due = new Date(today);
      due.setDate(due.getDate() + csStageOffsets[stage]);
      return {
        personId: opportunity.personId,
        opportunityId: opportunity.id,
        stage,
        dueDate: due.toISOString().slice(0, 10),
      };
    });
    await db.insert(customerSuccessStages).values(rows);

    await db.insert(timelineEvents).values({
      personId: opportunity.personId,
      opportunityId: opportunity.id,
      type: "customer_success",
      title: "Customer Success iniciado",
      description: "Etapas de relacionamento pós-venda criadas automaticamente.",
    });
  }

  return Response.json(updated);
}
