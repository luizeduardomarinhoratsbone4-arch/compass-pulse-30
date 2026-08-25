import type { Entry } from "@/hooks/useFinanceData";
import { MONTHS_SHORT } from "@/lib/format";

export const isRealized = (e: Entry) => e.status === "confirmado";
export const isActive = (e: Entry) => e.status !== "cancelado";

export const sumOf = (entries: Entry[]) => entries.reduce((acc, e) => acc + e.amount, 0);

export const inRange = (entries: Entry[], from: string, to: string) =>
  entries.filter((e) => e.occurred_on >= from && e.occurred_on <= to);

export const inMonth = (entries: Entry[], year: number, month: number) => {
  const prefix = `${year}-${`${month}`.padStart(2, "0")}`;
  return entries.filter((e) => e.occurred_on.startsWith(prefix));
};

export const inYear = (entries: Entry[], year: number) =>
  entries.filter((e) => e.occurred_on.startsWith(`${year}`));

export type MonthPoint = {
  key: string;
  label: string;
  receita: number;
  despesa: number;
  lucro: number;
};

/** Série dos últimos N meses terminando no mês de referência. */
export function monthlySeries(
  revenues: Entry[],
  expenses: Entry[],
  months = 12,
  reference = new Date(),
): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${`${m + 1}`.padStart(2, "0")}`;
    const receita = sumOf(revenues.filter((e) => isRealized(e) && e.occurred_on.startsWith(key)));
    const despesa = sumOf(expenses.filter((e) => isRealized(e) && e.occurred_on.startsWith(key)));
    points.push({
      key,
      label: `${MONTHS_SHORT[m]}/${`${y}`.slice(2)}`,
      receita,
      despesa,
      lucro: receita - despesa,
    });
  }
  return points;
}

export function yearlySeries(revenues: Entry[], expenses: Entry[], years = 4, reference = new Date()) {
  const out: { label: string; receita: number; despesa: number; lucro: number }[] = [];
  for (let i = years - 1; i >= 0; i--) {
    const y = reference.getFullYear() - i;
    const receita = sumOf(inYear(revenues, y).filter(isRealized));
    const despesa = sumOf(inYear(expenses, y).filter(isRealized));
    out.push({ label: `${y}`, receita, despesa, lucro: receita - despesa });
  }
  return out;
}

export function categoryBreakdown(entries: Entry[]) {
  const map = new Map<string, number>();
  for (const e of entries.filter(isRealized)) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export const growth = (current: number, previous: number) => {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-primary)",
  "var(--color-muted-foreground)",
];

/** Converte linhas em CSV (compatível com Excel/planilhas). */
export function toCsv(rows: Record<string, string | number>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(";")),
  ].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const csv = toCsv(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
