// ═══════════════════════════════════════════════════════════════════════════
// Repository: Pipeline & Stages (Drizzle + PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { eq, asc } from "drizzle-orm";
import { db } from "../index";
import { pipelines, pipelineStages } from "../schema";
import type { PipelineRepository, StageData } from "@/application/ports";

export class DrizzlePipelineRepository implements PipelineRepository {
  async getStageById(stageId: number): Promise<StageData | null> {
    const rows = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.id, stageId))
      .limit(1);

    if (!rows[0]) return null;

    return {
      id: rows[0].id,
      pipelineId: rows[0].pipelineId,
      name: rows[0].name,
      order: rows[0].order,
      kind: rows[0].kind as "open" | "won" | "lost",
      color: rows[0].color,
    };
  }

  async getStagesByPipeline(pipelineId: number): Promise<StageData[]> {
    const rows = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipelineId))
      .orderBy(asc(pipelineStages.order));

    return rows.map((r) => ({
      id: r.id,
      pipelineId: r.pipelineId,
      name: r.name,
      order: r.order,
      kind: r.kind as "open" | "won" | "lost",
      color: r.color,
    }));
  }

  async getDefaultPipeline(): Promise<{ id: number; name: string } | null> {
    const rows = await db
      .select({ id: pipelines.id, name: pipelines.name })
      .from(pipelines)
      .where(eq(pipelines.isDefault, true))
      .limit(1);

    // Fallback: se não tem default, pega o primeiro
    if (!rows[0]) {
      const fallback = await db
        .select({ id: pipelines.id, name: pipelines.name })
        .from(pipelines)
        .limit(1);
      return fallback[0] ?? null;
    }

    return rows[0];
  }
}
