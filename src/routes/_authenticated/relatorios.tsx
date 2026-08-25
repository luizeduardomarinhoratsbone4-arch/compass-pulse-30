import { createFileRoute } from "@tanstack/react-router";
import { Download, FileBarChart, PieChart as PieIcon, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { NoPermission, StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentSalaryMap, useEmployees, useEntries, useSalaries } from "@/hooks/useFinanceData";
import { logActivity } from "@/lib/audit";
import {
  categoryBreakdown,
  CHART_COLORS,
  downloadCsv,
  inYear,
  isRealized,
  monthlySeries,
  sumOf,
  yearlySeries,
} from "@/lib/finance";
import { brl, compactBrl, formatDate, pct } from "@/lib/format";
import { useOrg } from "@/lib/org";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Infradata" },
      {
        name: "description",
        content: "Relatórios comparativos de faturamento, despesas, lucro e equipe com exportação CSV.",
      },
      { property: "og:title", content: "Relatórios — Infradata" },
      {
        property: "og:description",
        content: "Análises mensais e anuais do comércio com exportação de dados.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { orgId, org, can } = useOrg();
  const { user } = useSession();
  const canView = can("finance.view");
  const canExport = can("reports.export");

  const { data, isLoading } = useEntries(orgId, canView);
  const { data: employees } = useEmployees(orgId, can("employees.view"));
  const { data: salaries } = useSalaries(orgId, can("salaries.view"));

  const [year, setYear] = useState(String(new Date().getFullYear()));

  const revenues = data?.revenues ?? [];
  const expenses = data?.expenses ?? [];

  const yearRev = inYear(revenues, Number(year)).filter(isRealized);
  const yearExp = inYear(expenses, Number(year)).filter(isRealized);
  const totalRev = sumOf(yearRev);
  const totalExp = sumOf(yearExp);
  const lucro = totalRev - totalExp;

  const months = useMemo(
    () => monthlySeries(revenues, expenses, 12, new Date(Number(year), 11, 31)),
    [revenues, expenses, year],
  );
  const years = useMemo(() => yearlySeries(revenues, expenses, 4), [revenues, expenses]);
  const revByCat = useMemo(() => categoryBreakdown(yearRev), [yearRev]);
  const expByCat = useMemo(() => categoryBreakdown(yearExp), [yearExp]);

  const salaryMap = currentSalaryMap(salaries ?? []);
  const byDepartment = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of (employees ?? []).filter((x) => x.status === "ativo")) {
      const key = e.department || "Sem departamento";
      map.set(key, (map.get(key) ?? 0) + (salaryMap.get(e.id) ?? 0));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, salaries]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  const exportEntries = async () => {
    const rows = [
      ...yearRev.map((e) => ({
        Tipo: "Receita",
        Data: formatDate(e.occurred_on),
        Categoria: e.category,
        Descrição: e.description ?? "",
        Status: e.status,
        Valor: e.amount,
      })),
      ...yearExp.map((e) => ({
        Tipo: "Despesa",
        Data: formatDate(e.occurred_on),
        Categoria: e.category,
        Descrição: e.description ?? "",
        Status: e.status,
        Valor: e.amount,
      })),
    ];
    if (!rows.length) {
      toast.error("Não há lançamentos para exportar neste ano.");
      return;
    }
    downloadCsv(`infradata-financeiro-${year}.csv`, rows);
    await logActivity(orgId!, user!.id, "relatorio.exportado", "revenues/expenses", `Ano ${year}`);
    toast.success("Relatório exportado.");
  };

  const exportMonthly = async () => {
    downloadCsv(
      `infradata-resumo-mensal-${year}.csv`,
      months.map((m) => ({
        Mês: m.label,
        Receita: m.receita,
        Despesa: m.despesa,
        Lucro: m.lucro,
      })),
    );
    await logActivity(orgId!, user!.id, "relatorio.exportado", "resumo_mensal", `Ano ${year}`);
    toast.success("Resumo mensal exportado.");
  };

  if (!canView) {
    return (
      <AppShell title="Relatórios">
        <NoPermission what="visualizar relatórios financeiros" />
      </AppShell>
    );
  }

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: "12px",
    fontSize: 12,
  };

  return (
    <AppShell
      title="Relatórios"
      description={`Análise consolidada${org ? ` de ${org.name}` : ""}.`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canExport && (
            <>
              <Button variant="outline" onClick={() => void exportMonthly()}>
                <Download className="mr-2 size-4" />
                Resumo mensal
              </Button>
              <Button onClick={() => void exportEntries()}>
                <Download className="mr-2 size-4" />
                Lançamentos
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Faturamento ${year}`} value={brl(totalRev)} icon={TrendingUp} tone="positive" />
        <StatCard label={`Despesas ${year}`} value={brl(totalExp)} icon={FileBarChart} tone="negative" />
        <StatCard
          label={`Lucro ${year}`}
          value={brl(lucro)}
          icon={TrendingUp}
          tone={lucro >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Margem de lucro"
          value={totalRev ? pct((lucro / totalRev) * 100) : "—"}
          icon={PieIcon}
        />
      </div>

      {isLoading ? (
        <div className="mt-4 h-72 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="surface-card p-5">
            <h3 className="mb-4 font-display text-base font-semibold">Receita x Despesa por mês</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v) => compactBrl(Number(v))}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => brl(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receita" name="Receita" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface-card p-5">
            <h3 className="mb-4 font-display text-base font-semibold">Evolução do lucro</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v) => compactBrl(Number(v))}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => brl(Number(v))} />
                  <Line
                    type="monotone"
                    dataKey="lucro"
                    name="Lucro"
                    stroke="var(--color-chart-4)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface-card p-5">
            <h3 className="mb-4 font-display text-base font-semibold">Despesas por categoria</h3>
            <div className="h-64">
              {expByCat.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expByCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                      {expByCat.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => brl(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="pt-24 text-center text-sm text-muted-foreground">Sem despesas em {year}.</p>
              )}
            </div>
          </div>

          <div className="surface-card p-5">
            <h3 className="mb-4 font-display text-base font-semibold">Receitas por categoria</h3>
            <div className="h-64">
              {revByCat.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revByCat} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      type="number"
                      fontSize={11}
                      stroke="var(--color-muted-foreground)"
                      tickFormatter={(v) => compactBrl(Number(v))}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      fontSize={11}
                      stroke="var(--color-muted-foreground)"
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => brl(Number(v))} />
                    <Bar dataKey="value" name="Receita" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="pt-24 text-center text-sm text-muted-foreground">Sem receitas em {year}.</p>
              )}
            </div>
          </div>

          <div className="surface-card p-5">
            <h3 className="mb-4 font-display text-base font-semibold">Comparativo anual</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={years}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v) => compactBrl(Number(v))}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => brl(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receita" name="Receita" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lucro" name="Lucro" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {can("salaries.view") && (
            <div className="surface-card p-5">
              <h3 className="mb-4 font-display text-base font-semibold">Folha por departamento</h3>
              <div className="h-64">
                {byDepartment.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byDepartment}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={95}
                      >
                        {byDepartment.map((entry, i) => (
                          <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => brl(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="pt-24 text-center text-sm text-muted-foreground">
                    Cadastre funcionários e salários para ver este relatório.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
