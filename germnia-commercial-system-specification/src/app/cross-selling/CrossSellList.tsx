"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { getCrossSellList } from "@/lib/queries";
import { Card, Pill, EmptyState } from "@/components/ui";
import { SecondaryButton, PrimaryButton } from "@/components/form";
import { crossSellStatusLabels } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { Repeat } from "lucide-react";

type Suggestions = Awaited<ReturnType<typeof getCrossSellList>>;

export function CrossSellList({ suggestions }: { suggestions: Suggestions }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function updateStatus(id: number, status: "convertida" | "descartada") {
    setLoadingId(id);
    await fetch(`/api/cross-selling/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoadingId(null);
    router.refresh();
  }

  const pending = suggestions.filter((s) => s.status === "sugerida");
  const resolved = suggestions.filter((s) => s.status !== "sugerida");

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Sugestões ativas</h2>
        {pending.length === 0 ? (
          <EmptyState title="Nenhuma sugestão pendente no momento" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <Repeat size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      <Link href={`/pessoas/${s.personId}`} className="hover:underline">
                        {s.personName}
                      </Link>{" "}
                      → <span className="font-semibold">{s.productName}</span>
                    </p>
                    <p className="text-xs text-slate-500">{s.reason}</p>
                    <p className="text-xs text-slate-400">
                      Responsável: {s.personOwnerName ?? "—"} · Sugerido em {formatDate(s.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <SecondaryButton onClick={() => updateStatus(s.id, "descartada")} disabled={loadingId === s.id}>
                    Descartar
                  </SecondaryButton>
                  <PrimaryButton onClick={() => updateStatus(s.id, "convertida")} disabled={loadingId === s.id}>
                    Marcar como convertida
                  </PrimaryButton>
                  <Link
                    href={`/pessoas/${s.personId}`}
                    className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Criar oportunidade
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico</h2>
        {resolved.length === 0 ? (
          <EmptyState title="Nenhum histórico ainda" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {resolved.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-slate-700">
                    {s.personName} → {s.productName}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(s.createdAt)}</p>
                </div>
                <Pill
                  className={
                    s.status === "convertida"
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20"
                      : "bg-slate-100 text-slate-600 ring-slate-500/20"
                  }
                >
                  {crossSellStatusLabels[s.status] ?? s.status}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
