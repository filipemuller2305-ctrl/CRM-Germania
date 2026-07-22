"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { getPipelinesWithStages, getOpportunitiesBoard, getUsers } from "@/lib/queries";
import { Card, Pill, EmptyState } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { Field, Input, Select, TextArea, PrimaryButton, SecondaryButton } from "@/components/form";
import { PersonPicker } from "@/components/PersonPicker";
import { cn, formatCurrency, formatDate, isPastDate, isTodayDate, todayISO } from "@/lib/utils";
import { originOptions } from "@/lib/labels";
import { Plus, AlertTriangle } from "lucide-react";

type Pipelines = Awaited<ReturnType<typeof getPipelinesWithStages>>;
type Pipeline = Pipelines[number];
type Opportunities = Awaited<ReturnType<typeof getOpportunitiesBoard>>;
type UsersList = Awaited<ReturnType<typeof getUsers>>;

export function KanbanBoard({
  pipeline,
  opportunities,
  users,
}: {
  pipeline: Pipeline;
  opportunities: Opportunities;
  users: UsersList;
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<number | null>(null);
  const [lostModal, setLostModal] = useState<{ oppId: number; stageId: number } | null>(null);
  const [newOppOpen, setNewOppOpen] = useState(false);

  const columns = useMemo(
    () => pipeline.stages.map((stage) => ({ stage, items: opportunities.filter((o) => o.stageId === stage.id) })),
    [pipeline, opportunities],
  );

  async function moveStage(oppId: number, stageId: number, lostReason?: string) {
    await fetch(`/api/opportunities/${oppId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId, lostReason }),
    });
    router.refresh();
  }

  function handleDrop(stageId: number, stageKind: string) {
    if (dragId == null) return;
    if (stageKind === "lost") {
      setLostModal({ oppId: dragId, stageId });
    } else {
      moveStage(dragId, stageId);
    }
    setDragId(null);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <PrimaryButton onClick={() => setNewOppOpen(true)}>
          <Plus size={14} /> Nova oportunidade
        </PrimaryButton>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(({ stage, items }) => (
          <div
            key={stage.id}
            className="w-72 shrink-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage.id, stage.kind)}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <h3 className="text-sm font-semibold text-slate-700">{stage.name}</h3>
              </div>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="min-h-[120px] space-y-2 rounded-xl bg-slate-100/60 p-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                  Solte aqui
                </div>
              ) : (
                items.map((o) => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={() => setDragId(o.id)}
                    onClick={() => router.push(`/pessoas/${o.personId}`)}
                    className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                  >
                    <p className="text-sm font-medium text-slate-800">{o.personName}</p>
                    <p className="text-xs text-slate-500">{o.product}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">{formatCurrency(o.estimatedValue)}</span>
                      <span className="text-xs text-slate-400">{o.ownerName ?? "—"}</span>
                    </div>
                    {o.nextStep ? (
                      <div
                        className={cn(
                          "mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-[11px]",
                          isPastDate(o.nextStep.dueDate)
                            ? "bg-rose-50 text-rose-700"
                            : isTodayDate(o.nextStep.dueDate)
                              ? "bg-sky-50 text-sky-700"
                              : "bg-slate-50 text-slate-500",
                        )}
                      >
                        {isPastDate(o.nextStep.dueDate) ? <AlertTriangle size={11} /> : null}
                        {o.nextStep.description} · {formatDate(o.nextStep.dueDate)}
                      </div>
                    ) : stage.kind === "open" ? (
                      <div className="mt-2 flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                        <AlertTriangle size={11} /> sem próximo passo
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <LostReasonModal
        open={lostModal != null}
        onClose={() => setLostModal(null)}
        onConfirm={(reason) => {
          if (lostModal) moveStage(lostModal.oppId, lostModal.stageId, reason);
          setLostModal(null);
        }}
      />

      <NewOpportunityGlobalModal
        open={newOppOpen}
        onClose={() => setNewOppOpen(false)}
        pipelines={[pipeline]}
        defaultPipelineId={pipeline.id}
        users={users}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

function LostReasonModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Motivo da perda">
      <Field label="Por que esta oportunidade foi perdida?" required>
        <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Preço, concorrência, desistência..." />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
        <PrimaryButton
          onClick={() => {
            onConfirm(reason);
            setReason("");
          }}
        >
          Confirmar perda
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function NewOpportunityGlobalModal({
  open,
  onClose,
  pipelines,
  defaultPipelineId,
  users,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  pipelines: Pipelines;
  defaultPipelineId: number;
  users: UsersList;
  onDone: () => void;
}) {
  const [person, setPerson] = useState<{ id: number; name: string } | null>(null);
  const [pipelineId, setPipelineId] = useState(String(defaultPipelineId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedPipeline = pipelines.find((p) => String(p.id) === pipelineId);
  const openStages = selectedPipeline?.stages.filter((s) => s.kind === "open") ?? [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!person) {
      setError("Selecione uma pessoa.");
      return;
    }
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      personId: person.id,
      product: String(form.get("product") || ""),
      pipelineId: Number(pipelineId),
      stageId: Number(form.get("stageId")),
      ownerId: form.get("ownerId") ? Number(form.get("ownerId")) : null,
      estimatedValue: form.get("estimatedValue") ? Number(form.get("estimatedValue")) : null,
      probability: form.get("probability") ? Number(form.get("probability")) : 50,
      origin: String(form.get("origin") || ""),
      notes: String(form.get("notes") || ""),
      nextStep: {
        description: String(form.get("nsDescription") || ""),
        ownerId: form.get("ownerId") ? Number(form.get("ownerId")) : null,
        dueDate: String(form.get("nsDueDate") || todayISO()),
        dueTime: String(form.get("nsDueTime") || ""),
        objective: String(form.get("nsObjective") || ""),
      },
    };
    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Não foi possível criar a oportunidade.");
      return;
    }
    setPerson(null);
    onClose();
    onDone();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova oportunidade">
      <form onSubmit={handleSubmit}>
        <Field label="Pessoa" required>
          <PersonPicker value={person} onChange={(p) => setPerson(p as { id: number; name: string } | null)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Produto" required>
            <Input name="product" required placeholder="Ex: Auto, Residencial, Vida..." />
          </Field>
          <Field label="Valor estimado (R$)">
            <Input name="estimatedValue" type="number" min="0" step="0.01" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pipeline" required>
            <Select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Etapa inicial" required>
            <Select name="stageId" defaultValue={openStages[0]?.id}>
              {openStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsável">
            <Select name="ownerId" defaultValue="">
              <option value="">Selecione...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Probabilidade (%)">
            <Input name="probability" type="number" min="0" max="100" defaultValue={50} />
          </Field>
        </div>
        <Field label="Origem">
          <Select name="origin" defaultValue="">
            <option value="">Selecione...</option>
            {originOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observações">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">Próximo passo (obrigatório)</p>
          <Field label="Descrição" required>
            <Input name="nsDescription" required placeholder="Ex: Ligar para apresentar cotação" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required>
              <Input type="date" name="nsDueDate" required defaultValue={todayISO()} />
            </Field>
            <Field label="Hora">
              <Input type="time" name="nsDueTime" />
            </Field>
          </div>
          <Field label="Objetivo">
            <Input name="nsObjective" />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Criar oportunidade"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
