import { getPipelinesWithStages, getOpportunitiesBoard, getUsers } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { KanbanBoard } from "./KanbanBoard";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OportunidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ pipelineId?: string }>;
}) {
  const { pipelineId } = await searchParams;
  const [pipelines, users] = await Promise.all([getPipelinesWithStages(), getUsers()]);
  const currentPipeline = pipelines.find((p) => String(p.id) === pipelineId) ?? pipelines[0];
  const opportunities = currentPipeline ? await getOpportunitiesBoard(currentPipeline.id) : [];

  return (
    <div>
      <PageHeader
        title="Oportunidades"
        description="Toda oportunidade está sempre em movimento. Arraste os cartões entre as etapas — o histórico é registrado automaticamente."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {pipelines.map((p) => (
          <Link
            key={p.id}
            href={`/oportunidades?pipelineId=${p.id}`}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              currentPipeline?.id === p.id
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
            )}
          >
            {p.name}
          </Link>
        ))}
      </div>

      {currentPipeline ? (
        <KanbanBoard pipeline={currentPipeline} opportunities={opportunities} users={users} />
      ) : null}
    </div>
  );
}
