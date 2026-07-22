"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  getPersonById,
  getPersonTimeline,
  getPersonActivities,
  getPersonOpportunities,
  getPersonProductsList,
  getPersonDocuments,
  getPersonCrossSell,
  getPersonCustomerSuccess,
  getPersonErpSync,
  getUsers,
  getProductTypes,
  getPipelinesWithStages,
} from "@/lib/queries";
import { Card, Pill, EmptyState, SectionTitle } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { Field, Input, Select, TextArea, PrimaryButton, SecondaryButton } from "@/components/form";
import {
  personStatusColors,
  personStatusLabels,
  activityTypeLabels,
  timelineTypeLabels,
  opportunityStatusLabels,
  nextStepStatusLabels,
  crossSellStatusLabels,
  customerSuccessStageLabels,
  productStatusLabels,
  originOptions,
} from "@/lib/labels";
import { cn, formatCurrency, formatDate, formatDateTime, initials, isPastDate, isTodayDate, todayISO } from "@/lib/utils";
import {
  Phone,
  MessageCircle,
  Mail,
  Users as UsersIcon,
  MapPin,
  MessageSquare,
  StickyNote,
  Plus,
  Pencil,
  CheckCircle2,
  RefreshCw,
  FileText,
  Shield,
  AlertTriangle,
} from "lucide-react";

type Person = NonNullable<Awaited<ReturnType<typeof getPersonById>>>;
type Timeline = Awaited<ReturnType<typeof getPersonTimeline>>;
type Activities = Awaited<ReturnType<typeof getPersonActivities>>;
type Opportunities = Awaited<ReturnType<typeof getPersonOpportunities>>;
type Products = Awaited<ReturnType<typeof getPersonProductsList>>;
type Documents = Awaited<ReturnType<typeof getPersonDocuments>>;
type CrossSell = Awaited<ReturnType<typeof getPersonCrossSell>>;
type CustomerSuccess = Awaited<ReturnType<typeof getPersonCustomerSuccess>>;
type ErpSync = Awaited<ReturnType<typeof getPersonErpSync>>;
type UsersList = Awaited<ReturnType<typeof getUsers>>;
type ProductTypes = Awaited<ReturnType<typeof getProductTypes>>;
type Pipelines = Awaited<ReturnType<typeof getPipelinesWithStages>>;

const tabs = [
  "Resumo",
  "Dados Cadastrais",
  "Timeline",
  "Atividades",
  "Próximos Passos",
  "Oportunidades",
  "Produtos",
  "Documentos",
  "Observações",
  "Integração ERP",
] as const;

type Tab = (typeof tabs)[number];

const activityIcons: Record<string, React.ElementType> = {
  ligacao: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  reuniao: UsersIcon,
  visita: MapPin,
  mensagem: MessageSquare,
  anotacao: StickyNote,
};

export function PersonWorkspace(props: {
  person: Person;
  timeline: Timeline;
  activities: Activities;
  opportunities: Opportunities;
  products: Products;
  documents: Documents;
  crossSell: CrossSell;
  customerSuccess: CustomerSuccess;
  erpSync: ErpSync;
  users: UsersList;
  productTypes: ProductTypes;
  pipelines: Pipelines;
}) {
  const { person } = props;
  const [tab, setTab] = useState<Tab>("Resumo");
  const router = useRouter();

  const openOpportunities = props.opportunities.filter((o) => o.status === "aberta");
  const overdueSteps = openOpportunities.filter((o) => o.nextStep && isPastDate(o.nextStep.dueDate));
  const pendingCS = props.customerSuccess.filter((c) => c.status === "pendente");

  function refresh() {
    router.refresh();
  }

  return (
    <div>
      <Card className="mb-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700">
              {initials(person.name)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">{person.name}</h1>
                <Pill className={personStatusColors[person.status] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"}>
                  {personStatusLabels[person.status] ?? person.status}
                </Pill>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {person.phone ?? person.whatsapp ?? "sem telefone"} {person.email ? `· ${person.email}` : ""}
              </p>
              <p className="text-xs text-slate-400">
                Responsável: {person.ownerName ?? "sem responsável"} · Cliente desde {formatDate(person.createdAt)} · Origem:{" "}
                {person.origin ?? "não informada"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {overdueSteps.length > 0 ? (
              <Pill className="bg-rose-100 text-rose-700 ring-rose-600/20">
                <AlertTriangle size={12} /> {overdueSteps.length} passo(s) atrasado(s)
              </Pill>
            ) : null}
            <LogActivityButton person={person} opportunities={openOpportunities} users={props.users} onDone={refresh} />
            <NewOpportunityButton person={person} pipelines={props.pipelines} users={props.users} onDone={refresh} />
          </div>
        </div>
      </Card>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors",
              tab === t ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {t}
            {t === "Próximos Passos" && overdueSteps.length > 0 ? (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {overdueSteps.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "Resumo" && (
        <ResumoTab
          person={person}
          opportunities={props.opportunities}
          products={props.products}
          timeline={props.timeline}
          crossSell={props.crossSell}
          pendingCS={pendingCS}
        />
      )}
      {tab === "Dados Cadastrais" && <DadosTab person={person} users={props.users} onDone={refresh} />}
      {tab === "Timeline" && <TimelineTab timeline={props.timeline} />}
      {tab === "Atividades" && <AtividadesTab activities={props.activities} />}
      {tab === "Próximos Passos" && (
        <ProximosPassosTab opportunities={openOpportunities} users={props.users} onDone={refresh} />
      )}
      {tab === "Oportunidades" && (
        <OportunidadesTab
          opportunities={props.opportunities}
          person={person}
          pipelines={props.pipelines}
          users={props.users}
          onDone={refresh}
        />
      )}
      {tab === "Produtos" && (
        <ProdutosTab
          products={props.products}
          productTypes={props.productTypes}
          crossSell={props.crossSell}
          personId={person.id}
          onDone={refresh}
        />
      )}
      {tab === "Documentos" && <DocumentosTab documents={props.documents} personId={person.id} onDone={refresh} />}
      {tab === "Observações" && <ObservacoesTab person={person} onDone={refresh} />}
      {tab === "Integração ERP" && <ErpTab erpSync={props.erpSync} personId={person.id} onDone={refresh} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------
function ResumoTab({
  person,
  opportunities,
  products,
  timeline,
  crossSell,
  pendingCS,
}: {
  person: Person;
  opportunities: Opportunities;
  products: Products;
  timeline: Timeline;
  crossSell: CrossSell;
  pendingCS: CustomerSuccess;
}) {
  const open = opportunities.filter((o) => o.status === "aberta");
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card className="p-5">
          <SectionTitle>Próximos passos</SectionTitle>
          {open.filter((o) => o.nextStep).length === 0 ? (
            <EmptyState title="Nenhum próximo passo pendente" description="Toda oportunidade aberta precisa de um." />
          ) : (
            <ul className="space-y-2">
              {open
                .filter((o) => o.nextStep)
                .map((o) => (
                  <li
                    key={o.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2",
                      isPastDate(o.nextStep!.dueDate)
                        ? "border-rose-200 bg-rose-50"
                        : isTodayDate(o.nextStep!.dueDate)
                          ? "border-sky-200 bg-sky-50"
                          : "border-slate-200 bg-white",
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{o.nextStep!.description}</p>
                      <p className="text-xs text-slate-500">
                        {o.product} · {formatDate(o.nextStep!.dueDate)} {o.nextStep!.dueTime ?? ""}
                      </p>
                    </div>
                    {isPastDate(o.nextStep!.dueDate) ? (
                      <Pill className="bg-rose-100 text-rose-700 ring-rose-600/20">Atrasado</Pill>
                    ) : isTodayDate(o.nextStep!.dueDate) ? (
                      <Pill className="bg-sky-100 text-sky-700 ring-sky-600/20">Hoje</Pill>
                    ) : (
                      <Pill className="bg-slate-100 text-slate-600 ring-slate-500/20">Agendado</Pill>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Últimos eventos</SectionTitle>
          {timeline.length === 0 ? (
            <EmptyState title="Sem eventos ainda" />
          ) : (
            <ul className="space-y-3">
              {timeline.slice(0, 6).map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="font-medium text-slate-800">{e.title}</p>
                  <p className="text-xs text-slate-500">{e.description}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(e.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle>Oportunidades</SectionTitle>
          <p className="text-2xl font-semibold text-slate-900">{open.length}</p>
          <p className="text-xs text-slate-500">abertas de {opportunities.length} no total</p>
        </Card>
        <Card className="p-5">
          <SectionTitle>Produtos ativos</SectionTitle>
          {products.length === 0 ? (
            <EmptyState title="Nenhum produto" />
          ) : (
            <ul className="space-y-1.5">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{p.productName}</span>
                  <Pill className={p.status === "ativa" ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20" : "bg-slate-100 text-slate-600 ring-slate-500/20"}>
                    {productStatusLabels[p.status] ?? p.status}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {crossSell.filter((c) => c.status === "sugerida").length > 0 ? (
          <Card className="p-5">
            <SectionTitle>Cross Selling</SectionTitle>
            <ul className="space-y-1.5">
              {crossSell
                .filter((c) => c.status === "sugerida")
                .map((c) => (
                  <li key={c.id} className="text-sm text-slate-700">
                    → {c.productName}
                    <p className="text-xs text-slate-400">{c.reason}</p>
                  </li>
                ))}
            </ul>
          </Card>
        ) : null}
        {pendingCS.length > 0 ? (
          <Card className="p-5">
            <SectionTitle>Customer Success pendente</SectionTitle>
            <ul className="space-y-1.5">
              {pendingCS.slice(0, 4).map((c) => (
                <li key={c.id} className="text-sm text-slate-700">
                  {customerSuccessStageLabels[c.stage] ?? c.stage}
                  <p className="text-xs text-slate-400">até {formatDate(c.dueDate)}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dados Cadastrais
// ---------------------------------------------------------------------------
function DadosTab({ person, users, onDone }: { person: Person; users: UsersList; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle>Dados cadastrais</SectionTitle>
        <SecondaryButton onClick={() => setOpen(true)}>
          <Pencil size={14} /> Editar
        </SecondaryButton>
      </div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Info label="Nome" value={person.name} />
        <Info label="CPF/CNPJ" value={person.document} />
        <Info label="Telefone" value={person.phone} />
        <Info label="WhatsApp" value={person.whatsapp} />
        <Info label="E-mail" value={person.email} />
        <Info label="Origem" value={person.origin} />
        <Info label="Responsável Comercial" value={person.ownerName} />
        <Info label="Status" value={personStatusLabels[person.status] ?? person.status} />
        <Info label="Data de cadastro" value={formatDate(person.createdAt)} />
        <Info label="Última atualização" value={formatDate(person.updatedAt)} />
      </dl>
      <EditPersonModal open={open} onClose={() => setOpen(false)} person={person} users={users} onDone={onDone} />
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function EditPersonModal({
  open,
  onClose,
  person,
  users,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  person: Person;
  users: UsersList;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      phone: String(form.get("phone") || ""),
      whatsapp: String(form.get("whatsapp") || ""),
      email: String(form.get("email") || ""),
      document: String(form.get("document") || ""),
      origin: String(form.get("origin") || ""),
      ownerId: form.get("ownerId") ? Number(form.get("ownerId")) : null,
      status: String(form.get("status") || "lead"),
    };
    await fetch(`/api/people/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    onClose();
    onDone();
  }
  return (
    <Modal open={open} onClose={onClose} title="Editar dados cadastrais">
      <form onSubmit={handleSubmit}>
        <Field label="Nome" required>
          <Input name="name" defaultValue={person.name} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <Input name="phone" defaultValue={person.phone ?? ""} />
          </Field>
          <Field label="WhatsApp">
            <Input name="whatsapp" defaultValue={person.whatsapp ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail">
            <Input name="email" defaultValue={person.email ?? ""} />
          </Field>
          <Field label="CPF/CNPJ">
            <Input name="document" defaultValue={person.document ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origem">
            <Select name="origin" defaultValue={person.origin ?? ""}>
              <option value="">Selecione...</option>
              {originOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Responsável Comercial">
            <Select name="ownerId" defaultValue={person.ownerId ?? ""}>
              <option value="">Sem responsável</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Status">
          <Select name="status" defaultValue={person.status}>
            <option value="lead">Lead</option>
            <option value="ativo">Em atendimento</option>
            <option value="cliente">Cliente</option>
            <option value="inativo">Inativo</option>
          </Select>
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar alterações"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
function TimelineTab({ timeline }: { timeline: Timeline }) {
  return (
    <Card className="p-5">
      <SectionTitle>Timeline — histórico completo e imutável</SectionTitle>
      {timeline.length === 0 ? (
        <EmptyState title="Nenhum evento registrado ainda" />
      ) : (
        <ol className="relative ml-2 border-l border-slate-200 pl-5">
          {timeline.map((e) => (
            <li key={e.id} className="mb-5 last:mb-0">
              <span className="absolute -ml-[25px] mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                {timelineTypeLabels[e.type] ?? e.type}
              </p>
              <p className="text-sm font-medium text-slate-800">{e.title}</p>
              {e.description ? <p className="text-sm text-slate-500">{e.description}</p> : null}
              <p className="text-xs text-slate-400">{formatDateTime(e.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Atividades
// ---------------------------------------------------------------------------
function AtividadesTab({ activities }: { activities: Activities }) {
  return (
    <Card className="p-5">
      <SectionTitle>Atividades realizadas</SectionTitle>
      {activities.length === 0 ? (
        <EmptyState title="Nenhuma atividade registrada" description="Use o botão 'Registrar atividade' no topo da página." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {activities.map((a) => {
            const Icon = activityIcons[a.type] ?? StickyNote;
            return (
              <li key={a.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Icon size={15} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{activityTypeLabels[a.type] ?? a.type}</p>
                  {a.description ? <p className="text-sm text-slate-500">{a.description}</p> : null}
                  <p className="text-xs text-slate-400">
                    {formatDateTime(a.createdAt)} · {a.ownerName ?? "—"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function LogActivityButton({
  person,
  opportunities,
  users,
  onDone,
}: {
  person: Person;
  opportunities: Opportunities;
  users: UsersList;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opportunityId, setOpportunityId] = useState<string>("");
  const [addNextStep, setAddNextStep] = useState(false);
  const selectedOpp = opportunities.find((o) => String(o.id) === opportunityId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload: any = {
      type: String(form.get("type") || "anotacao"),
      description: String(form.get("description") || ""),
      ownerId: form.get("ownerId") ? Number(form.get("ownerId")) : null,
      opportunityId: opportunityId ? Number(opportunityId) : null,
    };
    if (form.get("completeCurrent") === "on" && selectedOpp?.nextStep) {
      payload.completeNextStepId = selectedOpp.nextStep.id;
    }
    if (addNextStep && opportunityId) {
      payload.newNextStep = {
        description: String(form.get("nsDescription") || ""),
        ownerId: form.get("ownerId") ? Number(form.get("ownerId")) : null,
        dueDate: String(form.get("nsDueDate") || todayISO()),
        dueTime: String(form.get("nsDueTime") || ""),
        objective: String(form.get("nsObjective") || ""),
        opportunityId: Number(opportunityId),
      };
    }
    await fetch(`/api/people/${person.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    setOpen(false);
    setOpportunityId("");
    setAddNextStep(false);
    onDone();
  }

  return (
    <>
      <SecondaryButton onClick={() => setOpen(true)}>
        <Plus size={14} /> Registrar atividade
      </SecondaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar atividade">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" required>
              <Select name="type" defaultValue="ligacao">
                {Object.entries(activityTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Responsável">
              <Select name="ownerId" defaultValue={person.ownerId ?? ""}>
                <option value="">Selecione...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Descrição">
            <TextArea name="description" rows={3} placeholder="O que foi feito?" />
          </Field>
          <Field label="Relacionar a uma oportunidade (opcional)">
            <Select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
              <option value="">Nenhuma</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.product} — {o.stageName}
                </option>
              ))}
            </Select>
          </Field>
          {selectedOpp?.nextStep ? (
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="completeCurrent" className="rounded border-slate-300" />
              Concluir próximo passo atual: &quot;{selectedOpp.nextStep.description}&quot;
            </label>
          ) : null}
          {opportunityId ? (
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={addNextStep}
                onChange={(e) => setAddNextStep(e.target.checked)}
                className="rounded border-slate-300"
              />
              Definir novo próximo passo
            </label>
          ) : null}
          {addNextStep ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <Field label="Descrição do próximo passo" required>
                <Input name="nsDescription" required placeholder="Ex: Ligar para confirmar proposta" />
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
                <Input name="nsObjective" placeholder="O que se espera alcançar" />
              </Field>
            </div>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Registrar"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Próximos Passos
// ---------------------------------------------------------------------------
function ProximosPassosTab({
  opportunities,
  users,
  onDone,
}: {
  opportunities: Opportunities;
  users: UsersList;
  onDone: () => void;
}) {
  return (
    <Card className="p-5">
      <SectionTitle>Próximos passos das oportunidades abertas</SectionTitle>
      {opportunities.length === 0 ? (
        <EmptyState title="Nenhuma oportunidade aberta" />
      ) : (
        <ul className="space-y-3">
          {opportunities.map((o) => (
            <li key={o.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{o.product}</p>
                <Pill className="bg-slate-100 text-slate-600 ring-slate-500/20">{o.stageName}</Pill>
              </div>
              {o.nextStep ? (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2",
                    isPastDate(o.nextStep.dueDate) ? "bg-rose-50" : isTodayDate(o.nextStep.dueDate) ? "bg-sky-50" : "bg-slate-50",
                  )}
                >
                  <div>
                    <p className="text-sm text-slate-800">{o.nextStep.description}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(o.nextStep.dueDate)} {o.nextStep.dueTime ?? ""} · {o.nextStep.objective ?? ""}
                    </p>
                  </div>
                  <CompleteStepButton opportunity={o} users={users} onDone={onDone} />
                </div>
              ) : (
                <EmptyState title="Sem próximo passo — defina um agora" />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CompleteStepButton({
  opportunity,
  users,
  onDone,
}: {
  opportunity: Opportunities[number];
  users: UsersList;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      completeCurrentId: opportunity.nextStep?.id ?? null,
      newNextStep: {
        description: String(form.get("description") || ""),
        ownerId: form.get("ownerId") ? Number(form.get("ownerId")) : null,
        dueDate: String(form.get("dueDate") || todayISO()),
        dueTime: String(form.get("dueTime") || ""),
        objective: String(form.get("objective") || ""),
      },
    };
    await fetch(`/api/opportunities/${opportunity.id}/next-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    setOpen(false);
    onDone();
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
      >
        <CheckCircle2 size={13} /> Concluir e definir próximo
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Concluir passo e definir o próximo">
        <form onSubmit={handleSubmit}>
          <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Toda oportunidade aberta precisa de um próximo passo. Defina o que acontece agora.
          </p>
          <Field label="Descrição do novo próximo passo" required>
            <Input name="description" required placeholder="Ex: Enviar proposta revisada" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required>
              <Input type="date" name="dueDate" required defaultValue={todayISO()} />
            </Field>
            <Field label="Hora">
              <Input type="time" name="dueTime" />
            </Field>
          </div>
          <Field label="Objetivo">
            <Input name="objective" placeholder="O que se espera alcançar" />
          </Field>
          <Field label="Responsável">
            <Select name="ownerId" defaultValue={opportunity.ownerId ?? ""}>
              <option value="">Selecione...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Confirmar"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Oportunidades
// ---------------------------------------------------------------------------
function OportunidadesTab({
  opportunities,
  person,
  pipelines,
  users,
  onDone,
}: {
  opportunities: Opportunities;
  person: Person;
  pipelines: Pipelines;
  users: UsersList;
  onDone: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Oportunidades desta pessoa</SectionTitle>
        <NewOpportunityButton person={person} pipelines={pipelines} users={users} onDone={onDone} />
      </div>
      {opportunities.length === 0 ? (
        <EmptyState title="Nenhuma oportunidade" description="Toda oportunidade aberta precisa de um próximo passo." />
      ) : (
        <ul className="space-y-3">
          {opportunities.map((o) => (
            <li key={o.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {o.product} · {formatCurrency(o.estimatedValue)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {o.pipelineName} — {o.stageName} · Responsável: {o.ownerName ?? "—"}
                  </p>
                </div>
                <Pill
                  className={
                    o.status === "ganha"
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20"
                      : o.status === "perdida"
                        ? "bg-rose-100 text-rose-700 ring-rose-600/20"
                        : "bg-indigo-100 text-indigo-700 ring-indigo-600/20"
                  }
                >
                  {opportunityStatusLabels[o.status] ?? o.status}
                </Pill>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Criada em {formatDate(o.createdAt)} · Última movimentação {formatDate(o.lastMovementAt)}
              </p>
              {o.status === "aberta" && o.nextStep ? (
                <p className="mt-2 text-xs text-slate-600">
                  Próximo passo: {o.nextStep.description} ({formatDate(o.nextStep.dueDate)})
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NewOpportunityButton({
  person,
  pipelines,
  users,
  onDone,
}: {
  person: Person;
  pipelines: Pipelines;
  users: UsersList;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pipelineId, setPipelineId] = useState<string>(pipelines[0] ? String(pipelines[0].id) : "");
  const selectedPipeline = pipelines.find((p) => String(p.id) === pipelineId);
  const openStages = useMemo(() => selectedPipeline?.stages.filter((s) => s.kind === "open") ?? [], [selectedPipeline]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
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
    await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    setOpen(false);
    onDone();
  }

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)}>
        <Plus size={14} /> Nova oportunidade
      </PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title={`Nova oportunidade para ${person.name}`}>
        <form onSubmit={handleSubmit}>
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
              <Select name="ownerId" defaultValue={person.ownerId ?? ""}>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origem">
              <Select name="origin" defaultValue={person.origin ?? ""}>
                <option value="">Selecione...</option>
                {originOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Observações">
            <TextArea name="notes" rows={2} />
          </Field>

          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Próximo passo (obrigatório)
            </p>
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
              <Input name="nsObjective" placeholder="O que se espera alcançar" />
            </Field>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Criar oportunidade"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------
function ProdutosTab({
  products,
  productTypes,
  crossSell,
  personId,
  onDone,
}: {
  products: Products;
  productTypes: ProductTypes;
  crossSell: CrossSell;
  personId: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      productTypeId: Number(form.get("productTypeId")),
      policyNumber: String(form.get("policyNumber") || ""),
      insurer: String(form.get("insurer") || ""),
      status: String(form.get("status") || "ativa"),
      startDate: String(form.get("startDate") || ""),
      renewalDate: String(form.get("renewalDate") || ""),
      premiumValue: form.get("premiumValue") ? Number(form.get("premiumValue")) : null,
    };
    await fetch(`/api/people/${personId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    setOpen(false);
    onDone();
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Produtos contratados</SectionTitle>
        <PrimaryButton onClick={() => setOpen(true)}>
          <Plus size={14} /> Adicionar produto
        </PrimaryButton>
      </div>
      {products.length === 0 ? (
        <EmptyState title="Nenhum produto cadastrado" />
      ) : (
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <Shield size={16} />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {p.productName} {p.sourceErp ? <span className="text-xs text-slate-400">(via ERP)</span> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.insurer ?? "seguradora não informada"} · Apólice {p.policyNumber ?? "—"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Vigência: {formatDate(p.startDate)} até {formatDate(p.renewalDate)} · {formatCurrency(p.premiumValue)}
                  </p>
                </div>
              </div>
              <Pill
                className={
                  p.status === "ativa"
                    ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20"
                    : "bg-slate-100 text-slate-600 ring-slate-500/20"
                }
              >
                {productStatusLabels[p.status] ?? p.status}
              </Pill>
            </li>
          ))}
        </ul>
      )}

      {crossSell.length > 0 ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <SectionTitle>Sugestões de Cross Selling</SectionTitle>
          <ul className="space-y-1.5">
            {crossSell.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {c.productName} <span className="text-xs text-slate-400">— {c.reason}</span>
                </span>
                <Pill className="bg-indigo-50 text-indigo-700 ring-indigo-600/20">
                  {crossSellStatusLabels[c.status] ?? c.status}
                </Pill>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="Adicionar produto">
        <form onSubmit={handleSubmit}>
          <Field label="Produto" required>
            <Select name="productTypeId" required>
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seguradora">
              <Input name="insurer" />
            </Field>
            <Field label="Nº da apólice">
              <Input name="policyNumber" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início da vigência">
              <Input type="date" name="startDate" />
            </Field>
            <Field label="Renovação">
              <Input type="date" name="renewalDate" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prêmio (R$)">
              <Input type="number" step="0.01" name="premiumValue" />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="ativa">
                <option value="ativa">Ativa</option>
                <option value="em_cotacao">Em cotação</option>
                <option value="vencida">Vencida</option>
                <option value="cancelada">Cancelada</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Adicionar"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------
function DocumentosTab({ documents, personId, onDone }: { documents: Documents; personId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      type: String(form.get("type") || ""),
      url: String(form.get("url") || ""),
      notes: String(form.get("notes") || ""),
    };
    await fetch(`/api/people/${personId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    setOpen(false);
    onDone();
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Documentos</SectionTitle>
        <PrimaryButton onClick={() => setOpen(true)}>
          <Plus size={14} /> Adicionar documento
        </PrimaryButton>
      </div>
      {documents.length === 0 ? (
        <EmptyState title="Nenhum documento registrado" />
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <FileText size={16} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{d.name}</p>
                <p className="text-xs text-slate-500">{d.type ?? "documento"} · {formatDate(d.createdAt)}</p>
                {d.notes ? <p className="text-xs text-slate-400">{d.notes}</p> : null}
              </div>
              {d.url ? (
                <a href={d.url} target="_blank" className="text-xs font-medium text-indigo-600 hover:underline">
                  Abrir
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Adicionar documento">
        <form onSubmit={handleSubmit}>
          <Field label="Nome" required>
            <Input name="name" required placeholder="Ex: RG, Apólice, Contrato Social" />
          </Field>
          <Field label="Tipo">
            <Input name="type" placeholder="Ex: identidade, apólice, comprovante" />
          </Field>
          <Field label="Link (opcional)">
            <Input name="url" placeholder="https://..." />
          </Field>
          <Field label="Observações">
            <TextArea name="notes" rows={2} />
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Adicionar"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Observações
// ---------------------------------------------------------------------------
function ObservacoesTab({ person, onDone }: { person: Person; onDone: () => void }) {
  const [notes, setNotes] = useState(person.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setLoading(true);
    await fetch(`/api/people/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setLoading(false);
    setSaved(true);
    onDone();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card className="p-5">
      <SectionTitle>Observações gerais</SectionTitle>
      <TextArea
        rows={8}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anote informações relevantes sobre esta pessoa..."
      />
      <div className="mt-3 flex items-center gap-3">
        <PrimaryButton onClick={handleSave} disabled={loading}>
          {loading ? "Salvando..." : "Salvar observações"}
        </PrimaryButton>
        {saved ? <span className="text-xs text-emerald-600">Salvo com sucesso!</span> : null}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Integração ERP
// ---------------------------------------------------------------------------
function ErpTab({ erpSync, personId, onDone }: { erpSync: ErpSync; personId: number; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    await fetch("/api/erp/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    });
    setLoading(false);
    onDone();
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Integração com o ERP (Agger)</SectionTitle>
        <PrimaryButton onClick={handleSync} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Sincronizando..." : "Sincronizar agora"}
        </PrimaryButton>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        O ERP é responsável pelas informações operacionais (cotações, apólices, propostas, financeiro). O SCG mantém o
        relacionamento comercial e busca manter os dados sincronizados sempre que possível.
      </p>
      {erpSync.length === 0 ? (
        <EmptyState title="Nenhuma sincronização registrada ainda" description="Clique em 'Sincronizar agora' para simular." />
      ) : (
        <ul className="space-y-2">
          {erpSync.map((log) => (
            <li key={log.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {log.entity} · {log.externalId}
                </p>
                <p className="text-xs text-slate-500">{log.message}</p>
                <p className="text-xs text-slate-400">{formatDateTime(log.syncedAt)}</p>
              </div>
              <Pill
                className={
                  log.status === "sucesso"
                    ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20"
                    : "bg-rose-100 text-rose-700 ring-rose-600/20"
                }
              >
                {log.status}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
