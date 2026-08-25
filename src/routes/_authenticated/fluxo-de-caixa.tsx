import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Clock, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { NoPermission, StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
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
import { useEntries, type Entry } from "@/hooks/useFinanceData";
import { brl, compactBrl, formatDate, isoDay } from "@/lib/format";
import { isRealized, sumOf } from "@/lib/finance";
import { useOrg } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/fluxo-de-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Infradata" },
      {
        name: "description",
        content: "Entradas, saídas, saldo atual e saldo projetado da sua empresa por período.",
      },
      { property: "og:title", content: "Fluxo de Caixa — Infradata" },
      {
        property: "og:description",
        content: "Histórico financeiro com filtros de hoje, semana, mês, ano e período livre.",
      },
    ],
  }),
  component: CashflowPage,
});

type PeriodKey = "hoje" | "semana" | "mes" | "ano" | "custom";

function rangeFor(period: PeriodKey): { from: string; to: string } {
  const now = new Date();
  const to = isoDay(now);
  switch (period) {
    case "hoje":
      return { from: to, to };
    case "semana": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: isoDay(d), to };
    }
    case "ano":
      return { from: `${now.getFullYear()}-01-01`, to };
    case "mes":
    default:
      return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
}

function CashflowPage() {
  const { orgId, can } = useOrg();
  const canView = can("finance.view");
  const { data, isLoading } = useEntries(orgId, canView);

  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [custom, setCustom] = useState({ from: "", to: "" });

  const range =
    period === "custom" && custom.from && custom.to ? custom : rangeFor(period);

  const revenues = data?.revenues ?? [];
  const expenses = data?.expenses ?? [];

  const inRangeFilter = (e: Entry) => e.occurred_on >= range.from && e.occurred_on <= range.to;

  const entradas = sumOf(revenues.filter((e) => inRangeFilter(e) && isRealized(e)));
  const saidas = sumOf(expenses.filter((e) => inRangeFilter(e) && isRealized(e)));

  const saldoAtual =
    sumOf(revenues.filter((e) => isRealized(e) && e.occurred_on <= range.to)) -
    sumOf(expenses.filter((e) => isRealized(e) && e.occurred_on <= range.to));

  const pendentes =
    sumOf(revenues.filter((e) => e.status === "pendente")) -
    sumOf(expenses.filter((e) => e.status === "pendente"));

  const history = useMemo(() => {
    const rows = [
      ...revenues.filter(inRangeFilter).map((e) => ({ ...e, tipo: "Entrada" as const })),
      ...expenses.filter(inRangeFilter).map((e) => ({ ...e, tipo: "Saída" as const })),
    ].sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, range.from, range.to]);

  const chart = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of revenues.filter((r) => inRangeFilter(r) && isRealized(r)))
      byDay.set(e.occurred_on, (byDay.get(e.occurred_on) ?? 0) + e.amount);
    for (const e of expenses.filter((r) => inRangeFilter(r) && isRealized(r)))
      byDay.set(e.occurred_on, (byDay.get(e.occurred_on) ?? 0) - e.amount);
    let acc = 0;
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([day, delta]) => {
        acc += delta;
        return { label: formatDate(day).slice(0, 5), saldo: acc, movimento: delta };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, range.from, range.to]);

  if (!canView) {
    return (
      <AppShell title="Fluxo de Caixa">
        <NoPermission what="visualizar o fluxo de caixa" />
      </AppShell>
    );
  }

  const periods: { key: PeriodKey; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mês" },
    { key: "ano", label: "Ano" },
    { key: "custom", label: "Personalizado" },
  ];

  return (
    <AppShell
      title="Fluxo de Caixa"
      description={`Movimentações de ${formatDate(range.from)} a ${formatDate(range.to)}`}
    >
      <div className="surface-card mb-4 flex flex-wrap items-center gap-2 p-3">
        {periods.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={period === p.key ? "default" : "ghost"}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              className="w-40"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <span className="text-sm text-muted-foreground">até</span>
            <Input
              type="date"
              className="w-40"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entradas" value={brl(entradas)} icon={ArrowUpRight} tone="positive" />
        <StatCard label="Saídas" value={brl(saidas)} icon={ArrowDownLeft} tone="negative" />
        <StatCard
          label="Saldo atual"
          value={brl(saldoAtual)}
          icon={Wallet}
          tone={saldoAtual >= 0 ? "positive" : "negative"}
          hint="Acumulado de tudo que já foi confirmado"
        />
        <StatCard
          label="Saldo projetado"
          value={brl(saldoAtual + pendentes)}
          icon={Clock}
          hint="Inclui lançamentos pendentes"
        />
      </div>

      <div className="surface-card mt-4 p-5">
        <h3 className="mb-4 font-display text-base font-semibold">Evolução do saldo no período</h3>
        <div className="h-64">
          {isLoading ? (
            <div className="h-full animate-pulse rounded-lg bg-muted" />
          ) : chart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="saldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v) => compactBrl(Number(v))}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "12px",
                    fontSize: 12,
                  }}
                  formatter={(v) => brl(Number(v))}
                />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo"
                  stroke="var(--color-chart-2)"
                  fill="url(#saldo)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="pt-20 text-center text-sm text-muted-foreground">
              Nenhuma movimentação confirmada neste período.
            </p>
          )}
        </div>
      </div>

      <div className="surface-card mt-4 p-5">
        <h3 className="mb-4 font-display text-base font-semibold">Histórico financeiro</h3>
        {history.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice(0, 100).map((e) => (
                  <TableRow key={`${e.tipo}-${e.id}`}>
                    <TableCell className="numeric">{formatDate(e.occurred_on)}</TableCell>
                    <TableCell>
                      <Badge variant={e.tipo === "Entrada" ? "secondary" : "outline"}>{e.tipo}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{e.description || "—"}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="text-muted-foreground">{e.status}</TableCell>
                    <TableCell
                      className={`numeric text-right font-medium ${
                        e.tipo === "Entrada" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {e.tipo === "Entrada" ? "+" : "−"} {brl(e.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem movimentações no período selecionado.
          </p>
        )}
      </div>
    </AppShell>
  );
}
