import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database, Download, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { NoPermission } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/finance";
import { useOrg } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/banco-de-dados")({
  head: () => ({
    meta: [
      { title: "Banco de Dados — Infradata" },
      {
        name: "description",
        content:
          "Consulte todos os registros salvos da empresa: receitas, despesas, equipe, salários, metas, categorias e auditoria.",
      },
      { property: "og:title", content: "Banco de Dados — Infradata" },
      {
        property: "og:description",
        content: "Visualize e exporte os dados brutos armazenados da sua empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BancoDeDadosPage,
});

const TABLES = [
  { key: "revenues", label: "Receitas", order: "occurred_on" },
  { key: "expenses", label: "Despesas", order: "occurred_on" },
  { key: "employees", label: "Funcionários", order: "full_name" },
  { key: "employee_salaries", label: "Salários", order: "effective_from" },
  { key: "goals", label: "Metas", order: "period_year" },
  { key: "categories", label: "Categorias", order: "name" },
  { key: "notifications", label: "Notificações", order: "created_at" },
  { key: "audit_logs", label: "Auditoria", order: "created_at" },
  { key: "organization_members", label: "Membros", order: "created_at" },
] as const;

type TableKey = (typeof TABLES)[number]["key"];

function cellText(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function BancoDeDadosPage() {
  const { orgId, org, can } = useOrg();
  const [table, setTable] = useState<TableKey>("revenues");
  const [search, setSearch] = useState("");

  const meta = TABLES.find((t) => t.key === table)!;

  const query = useQuery({
    queryKey: ["db-browser", table, orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("org_id", orgId!)
        .order(meta.order, { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
  });

  const rows = useMemo(() => {
    const all = query.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((row) =>
      Object.values(row).some((v) => cellText(v).toLowerCase().includes(term)),
    );
  }, [query.data, search]);

  const columns = useMemo(() => {
    const first = (query.data ?? [])[0];
    return first ? Object.keys(first) : [];
  }, [query.data]);

  if (!can("finance.view")) {
    return (
      <AppShell title="Banco de Dados" description="Registros armazenados da empresa">
        <NoPermission what="o banco de dados" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Banco de Dados"
      description={`Todos os registros salvos${org ? ` de ${org.name}` : ""}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            <RefreshCw className="mr-2 size-4" />
            Atualizar
          </Button>
          <Button
            size="sm"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(
                `${meta.key}.csv`,
                rows.map((r) =>
                  Object.fromEntries(columns.map((c) => [c, cellText(r[c])])),
                ) as unknown as Record<string, string | number>[],
              )
            }
          >
            <Download className="mr-2 size-4" />
            Exportar CSV
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={table} onValueChange={(v) => setTable(v as TableKey)}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLES.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar em qualquer campo…"
            className="sm:max-w-xs"
          />
          <p className="text-sm text-muted-foreground sm:ml-auto">
            {rows.length} registro{rows.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          {query.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando registros…</p>
          ) : query.error ? (
            <p className="p-6 text-sm text-destructive">
              Não foi possível carregar: {(query.error as Error).message}
            </p>
          ) : !rows.length ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Database className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum registro em {meta.label.toLowerCase()} ainda.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.map((c) => (
                      <th
                        key={c}
                        className="whitespace-nowrap px-3 py-2.5 text-left font-medium text-muted-foreground"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={String(row["id"] ?? i)} className="border-t">
                      {columns.map((c) => (
                        <td key={c} className="max-w-[280px] truncate px-3 py-2.5">
                          {cellText(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
