import Link from "next/link";
import { getPeopleList, getUsers } from "@/lib/queries";
import { PageHeader, Card, Pill, EmptyState } from "@/components/ui";
import { NewPersonButton } from "./NewPersonButton";
import { personStatusColors, personStatusLabels } from "@/lib/labels";
import { formatDate, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const { search, status } = await searchParams;
  const [people, users] = await Promise.all([getPeopleList({ search, status }), getUsers()]);

  return (
    <div>
      <PageHeader
        title="Pessoas"
        description="A entidade central do SCG. Cada pessoa reúne todo o relacionamento comercial — nunca cadastros duplicados."
        action={<NewPersonButton users={users} />}
      />

      <Card className="mb-5 p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Buscar</label>
            <input
              name="search"
              defaultValue={search}
              placeholder="Nome, e-mail, telefone ou documento"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              <option value="lead">Lead</option>
              <option value="ativo">Em atendimento</option>
              <option value="cliente">Cliente</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Filtrar
          </button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {people.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Nenhuma pessoa encontrada" description="Ajuste os filtros ou cadastre uma nova pessoa." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Pessoa</th>
                <th className="px-5 py-3 font-medium">Contato</th>
                <th className="px-5 py-3 font-medium">Origem</th>
                <th className="px-5 py-3 font-medium">Responsável</th>
                <th className="px-5 py-3 font-medium">Oportunidades abertas</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/pessoas/${p.id}`} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {initials(p.name)}
                      </span>
                      <span className="font-medium text-slate-800 hover:text-indigo-700">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <div>{p.phone ?? p.whatsapp ?? "—"}</div>
                    <div className="text-xs text-slate-400">{p.email ?? ""}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.origin ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{p.ownerName ?? "—"}</td>
                  <td className="px-5 py-3">
                    {p.openOpportunities > 0 ? (
                      <Pill className="bg-indigo-50 text-indigo-700 ring-indigo-600/20">{p.openOpportunities} aberta(s)</Pill>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Pill className={personStatusColors[p.status] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"}>
                      {personStatusLabels[p.status] ?? p.status}
                    </Pill>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
