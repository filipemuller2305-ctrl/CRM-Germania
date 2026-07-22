import { getErpSyncLogList } from "@/lib/queries";
import { PageHeader, Card, Pill, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { SyncAllButton } from "./SyncAllButton";
import { Plug } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function IntegracaoErpPage() {
  const logs = await getErpSyncLogList();
  const hasCredentials = Boolean(process.env.AGGER_API_URL && process.env.AGGER_API_KEY);

  return (
    <div>
      <PageHeader
        title="Integração ERP — Agger"
        description="O ERP é a fonte das informações operacionais (cotações, apólices, propostas, financeiro). O SCG sincroniza o que for possível para evitar retrabalho."
        action={<SyncAllButton />}
      />

      <Card className="mb-5 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Plug size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-800">
              Status da conexão: {" "}
              <Pill className={hasCredentials ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20" : "bg-amber-100 text-amber-800 ring-amber-600/20"}>
                {hasCredentials ? "Configurado" : "Modo simulação"}
              </Pill>
            </p>
            <p className="text-xs text-slate-500">
              {hasCredentials
                ? "Credenciais do Agger detectadas neste ambiente."
                : "Configure AGGER_API_URL e AGGER_API_KEY nas variáveis de ambiente para ativar a sincronização real. Enquanto isso, o sistema simula o comportamento da integração."}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Log de sincronização</h2>
        {logs.length === 0 ? (
          <EmptyState title="Nenhuma sincronização registrada ainda" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Entidade</th>
                <th className="py-2 pr-3 font-medium">ID Externo (Agger)</th>
                <th className="py-2 pr-3 font-medium">Pessoa</th>
                <th className="py-2 pr-3 font-medium">Mensagem</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-3 capitalize text-slate-700">{log.entity}</td>
                  <td className="py-2 pr-3 text-slate-500">{log.externalId}</td>
                  <td className="py-2 pr-3 text-slate-700">{log.personName ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{log.message}</td>
                  <td className="py-2 pr-3">
                    <Pill
                      className={
                        log.status === "sucesso"
                          ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20"
                          : "bg-rose-100 text-rose-700 ring-rose-600/20"
                      }
                    >
                      {log.status}
                    </Pill>
                  </td>
                  <td className="py-2 pr-3 text-slate-400">{formatDateTime(log.syncedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
