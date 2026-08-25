import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileClock, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState, NoPermission, StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees, useEntries } from "@/hooks/useFinanceData";
import { downloadCsv } from "@/lib/finance";
import { formatDateTime } from "@/lib/format";
import { useOrg } from "@/lib/org";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança e LGPD — Infradata" },
      {
        name: "description",
        content: "Histórico de atividades, isolamento de dados por empresa e exportação LGPD.",
      },
      { property: "og:title", content: "Segurança e LGPD — Infradata" },
      {
        property: "og:description",
        content: "Auditoria de ações, controle de acesso e direitos do titular de dados.",
      },
    ],
  }),
  component: SecurityPage,
});

type AuditRow = {
  id: string;
  user_id: string;
  action: string;
  entity: string | null;
  detail: string | null;
  created_at: string;
};

function SecurityPage() {
  const { orgId, org, can, membership } = useOrg();
  const { user } = useSession();
  const canAudit = can("audit.view");
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit", orgId],
    enabled: !!orgId && canAudit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, user_id, action, entity, detail, created_at")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const { data: entries } = useEntries(orgId, can("finance.view"));
  const { data: employees } = useEmployees(orgId, can("employees.view"));

  const list = (logs ?? []).filter((l) =>
    search
      ? `${l.action} ${l.entity ?? ""} ${l.detail ?? ""}`.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  const exportData = () => {
    const rows = [
      {
        Tipo: "Perfil",
        Identificador: user?.email ?? "",
        Detalhe: `Papel: ${membership?.role ?? "—"} · Empresa: ${org?.name ?? "—"}`,
        Data: formatDateTime(user?.created_at ?? null),
      },
      ...(entries?.revenues ?? []).map((e) => ({
        Tipo: "Receita",
        Identificador: e.id,
        Detalhe: `${e.category} · ${e.description ?? ""}`,
        Data: e.occurred_on,
      })),
      ...(entries?.expenses ?? []).map((e) => ({
        Tipo: "Despesa",
        Identificador: e.id,
        Detalhe: `${e.category} · ${e.description ?? ""}`,
        Data: e.occurred_on,
      })),
      ...(employees ?? []).map((e) => ({
        Tipo: "Funcionário",
        Identificador: e.id,
        Detalhe: `${e.full_name} · ${e.job_title ?? ""}`,
        Data: e.hired_on ?? "",
      })),
    ];
    downloadCsv(`infradata-dados-${org?.name ?? "empresa"}.csv`, rows);
    toast.success("Exportação LGPD gerada.");
  };

  return (
    <AppShell
      title="Segurança e LGPD"
      description="Rastreabilidade das ações e direitos sobre os dados da empresa."
      actions={
        <Button variant="outline" onClick={exportData}>
          <Download className="mr-2 size-4" />
          Exportar meus dados
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Isolamento de dados"
          value="Ativo"
          icon={Lock}
          tone="positive"
          hint="Cada empresa acessa apenas os próprios registros"
        />
        <StatCard
          label="Controle de acesso"
          value={membership?.role ?? "—"}
          icon={ShieldCheck}
          hint="Permissões aplicadas no banco de dados"
        />
        <StatCard
          label="Eventos registrados"
          value={canAudit ? String(logs?.length ?? 0) : "—"}
          icon={FileClock}
          hint="Últimos 300 eventos"
        />
      </div>

      <div className="surface-card mt-4 p-5">
        <h3 className="font-display text-base font-semibold">Como protegemos os seus dados</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Cada registro pertence a uma empresa e é filtrado por políticas no próprio banco.</li>
          <li>• Salários e dados sensíveis exigem permissão específica, mesmo dentro da empresa.</li>
          <li>• Toda criação, alteração e exclusão relevante fica registrada no histórico abaixo.</li>
          <li>• Você pode exportar os dados da empresa a qualquer momento em formato aberto (CSV).</li>
          <li>• A sessão é encerrada automaticamente após o período de inatividade configurado.</li>
        </ul>
      </div>

      <div className="surface-card mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">Histórico de atividades</h3>
          {canAudit && (
            <Input
              className="w-full sm:w-72"
              placeholder="Buscar ação ou detalhe"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </div>

        <div className="mt-4">
          {!canAudit ? (
            <NoPermission what="ver o histórico de atividades" />
          ) : isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          ) : list.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="numeric whitespace-nowrap">
                        {formatDateTime(l.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">{l.action}</TableCell>
                      <TableCell className="text-muted-foreground">{l.entity ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{l.detail ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title="Sem eventos registrados"
              description="As ações realizadas na plataforma aparecerão aqui automaticamente."
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
