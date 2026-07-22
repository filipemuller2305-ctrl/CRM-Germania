import Link from "next/link";
import { getDashboardData } from "@/lib/queries";
import { PageHeader, Card, Pill, EmptyState, SectionTitle } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarClock,
  UserPlus,
  Repeat,
  RefreshCw,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div>
      <PageHeader
        title="Bom trabalho hoje 👋"
        description="O painel prioriza ações. Comece pelo que está atrasado, depois siga para o que vence hoje."
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Oportunidades abertas" value={String(data.openCount)} sub={formatCurrency(data.totalOpenValue)} />
        <StatCard label="Follow-ups hoje" value={String(data.followUpsToday.length)} tone="sky" />
        <StatCard label="Passos atrasados" value={String(data.overdueSteps.length)} tone="rose" />
        <StatCard label="Leads novos" value={String(data.newLeads.length)} tone="amber" />
        <StatCard label="Cross selling" value={String(data.crossSell.length)} tone="indigo" />
        <StatCard label="Ganhas no mês" value={String(data.wonThisMonthCount)} sub={formatCurrency(data.wonThisMonthValue)} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PriorityBlock
          title="Próximos passos atrasados"
          icon={<AlertTriangle size={16} className="text-rose-600" />}
          emptyText="Nenhum próximo passo atrasado. Excelente!"
          items={data.overdueSteps.map((s) => ({
            key: s.id,
            href: `/pessoas/${s.personId}`,
            title: s.personName ?? "—",
            subtitle: s.description,
            meta: `${s.product ?? "Produto"} · venceu em ${formatDate(s.dueDate)}`,
            tone: "rose" as const,
          }))}
        />

        <PriorityBlock
          title="Follow-ups de hoje"
          icon={<CalendarClock size={16} className="text-sky-600" />}
          emptyText="Nenhum follow-up agendado para hoje."
          items={data.followUpsToday.map((s) => ({
            key: s.id,
            href: `/pessoas/${s.personId}`,
            title: s.personName ?? "—",
            subtitle: s.description,
            meta: `${s.product ?? "Produto"} ${s.dueTime ? `· ${s.dueTime}` : ""} · ${s.ownerName ?? ""}`,
            tone: "sky" as const,
          }))}
        />

        <PriorityBlock
          title="Leads novos — quem precisa de atendimento"
          icon={<UserPlus size={16} className="text-amber-600" />}
          emptyText="Nenhum lead novo pendente."
          items={data.newLeads.map((l) => ({
            key: l.id,
            href: `/pessoas/${l.id}`,
            title: l.name,
            subtitle: `Origem: ${l.origin ?? "não informada"}`,
            meta: `Responsável: ${l.ownerName ?? "sem dono"} · ${formatDate(l.createdAt)}`,
            tone: "amber" as const,
          }))}
        />

        <PriorityBlock
          title="Oportunidades de Cross Selling"
          icon={<Repeat size={16} className="text-indigo-600" />}
          emptyText="Nenhuma sugestão de cross selling no momento."
          items={data.crossSell.map((c) => ({
            key: c.id,
            href: `/pessoas/${c.personId}`,
            title: `${c.personName ?? "—"} → ${c.productName}`,
            subtitle: c.reason ?? "",
            meta: "Ver na aba Cross Selling",
            tone: "indigo" as const,
          }))}
          footer={
            <Link href="/cross-selling" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
              Ver todas <ArrowRight size={12} />
            </Link>
          }
        />

        <PriorityBlock
          title="Renovações se aproximando (45 dias)"
          icon={<RefreshCw size={16} className="text-emerald-600" />}
          emptyText="Nenhuma renovação nos próximos 45 dias."
          items={data.renewals.map((r) => ({
            key: r.id,
            href: `/pessoas/${r.personId}`,
            title: `${r.personName ?? "—"} — ${r.productName}`,
            subtitle: `Vencimento em ${formatDate(r.renewalDate)}`,
            meta: "",
            tone: "emerald" as const,
          }))}
        />

        <PriorityBlock
          title="Oportunidades abertas"
          icon={<TrendingUp size={16} className="text-slate-600" />}
          emptyText="Nenhuma oportunidade aberta."
          items={data.openOpportunities.slice(0, 8).map((o) => ({
            key: o.id,
            href: `/pessoas/${o.personId}`,
            title: `${o.personName ?? "—"} — ${o.product}`,
            subtitle: `${o.stageName ?? ""} · ${o.ownerName ?? ""}`,
            meta: formatCurrency(o.estimatedValue),
            tone: "slate" as const,
          }))}
          footer={
            <Link href="/oportunidades" className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:underline">
              Ver pipeline completo <ArrowRight size={12} />
            </Link>
          }
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "slate" | "sky" | "rose" | "amber" | "indigo" | "emerald";
}) {
  const toneClasses: Record<string, string> = {
    slate: "text-slate-900",
    sky: "text-sky-700",
    rose: "text-rose-700",
    amber: "text-amber-700",
    indigo: "text-indigo-700",
    emerald: "text-emerald-700",
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClasses[tone]}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
    </Card>
  );
}

function PriorityBlock({
  title,
  icon,
  items,
  emptyText,
  footer,
}: {
  title: string;
  icon: React.ReactNode;
  items: { key: number; href: string; title: string; subtitle?: string | null; meta?: string; tone: "rose" | "sky" | "amber" | "indigo" | "emerald" | "slate" }[];
  emptyText: string;
  footer?: React.ReactNode;
}) {
  const dotTone: Record<string, string> = {
    rose: "bg-rose-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    slate: "bg-slate-400",
  };
  return (
    <Card className="p-5">
      <SectionTitle
        action={<span className="text-slate-400">{icon}</span>}
      >
        {title}
      </SectionTitle>
      {items.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="flex items-start gap-3 py-2.5 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotTone[item.tone]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{item.title}</span>
                  {item.subtitle ? (
                    <span className="block truncate text-xs text-slate-500">{item.subtitle}</span>
                  ) : null}
                  {item.meta ? <span className="block text-xs text-slate-400">{item.meta}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {footer ? <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div> : null}
    </Card>
  );
}
