"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { getCustomerSuccessList } from "@/lib/queries";
import { Card, Pill, EmptyState } from "@/components/ui";
import { customerSuccessStageLabels } from "@/lib/labels";
import { cn, formatDate, isPastDate } from "@/lib/utils";
import { CheckCircle2, HeartHandshake } from "lucide-react";

type Stages = Awaited<ReturnType<typeof getCustomerSuccessList>>;

export function CustomerSuccessBoard({ stages }: { stages: Stages }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function complete(id: number) {
    setLoadingId(id);
    await fetch(`/api/customer-success/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "concluido" }),
    });
    setLoadingId(null);
    router.refresh();
  }

  const pending = stages.filter((s) => s.status === "pendente");
  const overdue = pending.filter((s) => isPastDate(s.dueDate));
  const upcoming = pending.filter((s) => !isPastDate(s.dueDate));
  const done = stages.filter((s) => s.status !== "pendente");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-rose-600">
            Atrasadas ({overdue.length})
          </h2>
          {overdue.length === 0 ? (
            <EmptyState title="Nenhuma etapa atrasada" />
          ) : (
            <StageList items={overdue} onComplete={complete} loadingId={loadingId} tone="rose" />
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-600">
            Próximas ({upcoming.length})
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState title="Nenhuma etapa pendente" />
          ) : (
            <StageList items={upcoming} onComplete={complete} loadingId={loadingId} tone="sky" />
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Concluídas / Canceladas</h2>
        {done.length === 0 ? (
          <EmptyState title="Nenhum histórico ainda" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {done.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-slate-700">
                    <Link href={`/pessoas/${s.personId}`} className="hover:underline">
                      {s.personName}
                    </Link>{" "}
                    — {customerSuccessStageLabels[s.stage] ?? s.stage}
                  </p>
                  <p className="text-xs text-slate-400">{s.product}</p>
                </div>
                <Pill className="bg-emerald-100 text-emerald-700 ring-emerald-600/20">{s.status}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StageList({
  items,
  onComplete,
  loadingId,
  tone,
}: {
  items: Stages;
  onComplete: (id: number) => void;
  loadingId: number | null;
  tone: "rose" | "sky";
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                tone === "rose" ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-600",
              )}
            >
              <HeartHandshake size={15} />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">
                <Link href={`/pessoas/${s.personId}`} className="hover:underline">
                  {s.personName}
                </Link>
              </p>
              <p className="text-xs text-slate-500">
                {customerSuccessStageLabels[s.stage] ?? s.stage} · {s.product}
              </p>
              <p className="text-xs text-slate-400">até {formatDate(s.dueDate)}</p>
            </div>
          </div>
          <button
            onClick={() => onComplete(s.id)}
            disabled={loadingId === s.id}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <CheckCircle2 size={13} /> Concluir
          </button>
        </li>
      ))}
    </ul>
  );
}
