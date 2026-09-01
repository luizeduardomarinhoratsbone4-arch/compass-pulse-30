import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  CreditCard,
  PiggyBank,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
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

import { AppShell } from "@/components/AppShell";
import { EmptyState, StatCard } from "@/components/StatCard";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  currentSalaryMap,
  useEmployees,
  useEntries,
  useGoals,
  useSalaries,
} from "@/hooks/useFinanceData";
import { brl, compactBrl, MONTHS_LONG, pct } from "@/lib/format";
import {
  CHART_COLORS,
  categoryBreakdown,
  growth,
  inMonth,
  inYear,
  isRealized,
  monthlySeries,
  sumOf,
  yearlySeries,
} from "@/lib/finance";
import { useOrg } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Visão geral da sua empresa — Infradata" },
      {
        name: "description",
        content:
          "Painel com faturamento, lucro, despesas, folha salarial e metas do mês e do ano da sua empresa.",
      },
      { property: "og:title", content: "Visão geral da sua empresa — Infradata" },
      {
        property: "og:description",
        content: "Indicadores mensais e anuais calculados a partir dos seus lançamentos.",
      },
    ],
  }),
  component: DashboardPage,
});

const chartTooltip = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: "12px",
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  },
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card p-5">
      <div className="mb-4">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { orgId, org, can } = useOrg();
  const canFinance = can("finance.view");
  const canEmployees = can("employees.view");
  const canSalaries = can("salaries.view");

  const { data: entries, isLoading } = useEntries(orgId, canFinance);
  const { data: employees } = useEmployees(orgId, canEmployees);
  const { data: salaries } = useSalaries(orgId, canSalaries);
  const { data: goals } = useGoals(orgId);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const stats = useMemo(() => {
    const revenues = entries?.revenues ?? [];
    const expenses = entries?.expenses ?? [];

    const monthRev = sumOf(inMonth(revenues, year, month).filter(isRealized));
    const monthExp = sumOf(inMonth(expenses, year, month).filter(isRealized));
    const prevDate = new Date(year, month - 2, 1);
    const prevRev = sumOf(
      inMonth(revenues, prevDate.getFullYear(), prevDate.getMonth() + 1).filter(isRealized),
    );
    const prevExp = sumOf(
      inMonth(expenses, prevDate.getFullYear(), prevDate.getMonth() + 1).filter(isRealized),
    );
    const yearRev = sumOf(inYear(revenues, year).filter(isRealized));
    const yearExp = sumOf(inYear(expenses, year).filter(isRealized));

    return {
      monthRev,
      monthExp,
      monthProfit: monthRev - monthExp,
      prevRev,
      prevProfit: prevRev - prevExp,
      yearRev,
      yearExp,
      yearProfit: yearRev - yearExp,
      revGrowth: growth(monthRev, prevRev),
    };
  }, [entries, year, month]);

  const salaryMap = currentSalaryMap(salaries ?? []);
  const activeEmployees = (employees ?? []).filter((e) => e.status === "ativo");
  const payroll = activeEmployees.reduce((acc, e) => acc + (salaryMap.get(e.id) ?? 0), 0);

  const monthGoal = (goals ?? []).find(
    (g) => g.period_year === year && g.period_month === month && g.goal_type === "faturamento",
  );
  const goalProgress = monthGoal ? (stats.monthRev / monthGoal.target_amount) * 100 : 0;

  const series = useMemo(
    () => monthlySeries(entries?.revenues ?? [], entries?.expenses ?? [], 12, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries],
  );
  const years = useMemo(
    () => yearlySeries(entries?.revenues ?? [], entries?.expenses ?? [], 4, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries],
  );
  const expensePie = useMemo(
    () => categoryBreakdown(inYear(entries?.expenses ?? [], year)),
    [entries, year],
  );

  const alerts = useMemo(() => {
    const list: { tone: "positive" | "negative" | "neutral"; text: string }[] = [];
    if (stats.prevRev > 0 && stats.revGrowth < -10)
      list.push({
        tone: "negative",
        text: `Queda de ${pct(Math.abs(stats.revGrowth))} no faturamento em relação ao mês anterior.`,
      });
    if (stats.prevRev > 0 && stats.revGrowth > 10)
      list.push({
        tone: "positive",
        text: `Crescimento de ${pct(stats.revGrowth)} no faturamento em relação ao mês anterior.`,
      });
    if (stats.monthExp > stats.monthRev && stats.monthExp > 0)
      list.push({ tone: "negative", text: "Despesas do mês acima do faturamento registrado." });
    if (monthGoal && goalProgress >= 80 && goalProgress < 100)
      list.push({ tone: "neutral", text: `Meta do mês em ${pct(goalProgress)} — quase lá.` });
    if (monthGoal && goalProgress >= 100)
      list.push({ tone: "positive", text: "Meta de faturamento do mês atingida." });
    return list;
  }, [stats, monthGoal, goalProgress]);

  if (!canFinance && !canEmployees) {
    return (
      <AppShell title="Visão geral da sua empresa" description={org?.name}>
        <EmptyState
          title="Sem indicadores liberados"
          description="Seu perfil ainda não tem permissão para visualizar dados financeiros ou de equipe."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Visão geral da sua empresa"
      description={`${org?.name ?? ""} · ${MONTHS_LONG[month - 1]} de ${year}`}
      actions={
        canFinance ? (
          <Button onClick={() => void addRevenue()} disabled={adding}>
            <BadgeDollarSign className="mr-2 size-4" />
            {`+ ${brl(BUMP_AMOUNT)}`}
          </Button>
        ) : undefined
      }
    >

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="💰 Faturamento do mês"
          value={canFinance ? brl(stats.monthRev) : "—"}
          hint={
            canFinance && stats.prevRev > 0
              ? `${stats.revGrowth >= 0 ? "+" : ""}${pct(stats.revGrowth)} vs. mês anterior`
              : "Somatório das receitas confirmadas"
          }
          icon={Wallet}
        />
        <StatCard
          label="📈 Lucro do mês"
          value={canFinance ? brl(stats.monthProfit) : "—"}
          hint="Receitas menos despesas do mês (estimativa)"
          icon={stats.monthProfit >= 0 ? ArrowUpRight : ArrowDownRight}
          tone={stats.monthProfit >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="📊 Faturamento anual"
          value={canFinance ? brl(stats.yearRev) : "—"}
          hint={`Acumulado de ${year}`}
          icon={TrendingUp}
        />
        <StatCard
          label="💵 Lucro anual"
          value={canFinance ? brl(stats.yearProfit) : "—"}
          hint="Estimativa com base nos lançamentos"
          icon={PiggyBank}
          tone={stats.yearProfit >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="👥 Funcionários"
          value={canEmployees ? `${activeEmployees.length}` : "—"}
          hint={canEmployees ? "Ativos no momento" : "Requer permissão de equipe"}
          icon={Users}
        />
        <StatCard
          label="💳 Folha salarial"
          value={canSalaries ? brl(payroll) : "—"}
          hint={canSalaries ? "Custo mensal da equipe ativa" : "Requer permissão de salários"}
          icon={CreditCard}
        />
        <StatCard
          label="📉 Despesas do mês"
          value={canFinance ? brl(stats.monthExp) : "—"}
          hint="Somatório das despesas confirmadas"
          icon={TrendingDown}
          tone={stats.monthExp > 0 ? "negative" : "neutral"}
        />
        <StatCard
          label="🎯 Meta do mês"
          value={monthGoal ? pct(Math.min(goalProgress, 999)) : "—"}
          hint={monthGoal ? `Alvo: ${brl(monthGoal.target_amount)}` : "Nenhuma meta definida"}
          icon={Target}
        />
      </div>

      {monthGoal && (
        <div className="surface-card mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-sm font-semibold">{monthGoal.title}</p>
              <p className="text-xs text-muted-foreground numeric">
                {brl(stats.monthRev)} de {brl(monthGoal.target_amount)}
              </p>
            </div>
            <Badge variant={goalProgress >= 100 ? "default" : "secondary"}>
              {pct(Math.min(goalProgress, 999))}
            </Badge>
          </div>
          <Progress value={Math.min(goalProgress, 100)} className="mt-3" />
        </div>
      )}

      {!!alerts.length && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {alerts.map((a) => (
            <div
              key={a.text}
              className={`surface-card flex items-start gap-3 p-4 text-sm ${
                a.tone === "negative"
                  ? "border-destructive/40"
                  : a.tone === "positive"
                    ? "border-success/40"
                    : ""
              }`}
            >
              <BadgeDollarSign
                className={`mt-0.5 size-4 shrink-0 ${
                  a.tone === "negative"
                    ? "text-destructive"
                    : a.tone === "positive"
                      ? "text-success"
                      : "text-primary"
                }`}
              />
              {a.text}
            </div>
          ))}
        </div>
      )}

      {canFinance ? (
        isLoading ? (
          <div className="mt-6 h-64 animate-pulse rounded-xl bg-muted" />
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <ChartCard title="Faturamento dos últimos 12 meses" subtitle="Receitas confirmadas">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v) => compactBrl(Number(v))}
                />
                <Tooltip {...chartTooltip} formatter={(v) => brl(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="receita"
                  name="Faturamento"
                  stroke="var(--color-chart-1)"
                  fill="url(#rev)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Lucro mensal" subtitle="Receitas menos despesas por mês">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v) => compactBrl(Number(v))}
                />
                <Tooltip {...chartTooltip} formatter={(v) => brl(Number(v))} />
                <Line
                  type="monotone"
                  dataKey="lucro"
                  name="Lucro"
                  stroke="var(--color-chart-3)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartCard>

            <ChartCard title="Receitas x Despesas" subtitle="Comparativo mensal">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v) => compactBrl(Number(v))}
                />
                <Tooltip {...chartTooltip} formatter={(v) => brl(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receitas" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesas" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Evolução anual" subtitle="Faturamento e lucro por ano">
              <BarChart data={years}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v) => compactBrl(Number(v))}
                />
                <Tooltip {...chartTooltip} formatter={(v) => brl(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Faturamento" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <div className="surface-card p-5 xl:col-span-2">
              <div className="mb-4">
                <h3 className="font-display text-base font-semibold">Distribuição das despesas</h3>
                <p className="text-xs text-muted-foreground">Por categoria, no ano de {year}</p>
              </div>
              {expensePie.length ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expensePie}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={2}
                        >
                          {expensePie.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip {...chartTooltip} formatter={(v) => brl(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2 self-center">
                    {expensePie.slice(0, 8).map((c, i) => (
                      <li key={c.name} className="flex items-center gap-3 text-sm">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="flex-1">{c.name}</span>
                        <span className="numeric text-muted-foreground">{brl(c.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma despesa registrada ainda.
                </p>
              )}
            </div>
          </div>
        )
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">
        Todos os valores são calculados a partir dos lançamentos registrados pela sua empresa.
        Lucro e resultados são estimativas e dependem da completude desses registros.
      </p>
    </AppShell>
  );
}
