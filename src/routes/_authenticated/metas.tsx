import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState, NoPermission, StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEntries, useGoals, type Goal } from "@/hooks/useFinanceData";
import { logActivity } from "@/lib/audit";
import { isRealized, sumOf } from "@/lib/finance";
import { brl, MONTHS_LONG, pct } from "@/lib/format";
import { useOrg } from "@/lib/org";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Infradata" },
      {
        name: "description",
        content: "Defina metas de faturamento, lucro e redução de despesas e acompanhe o progresso.",
      },
      { property: "og:title", content: "Metas — Infradata" },
      {
        property: "og:description",
        content: "Acompanhamento automático das metas com base nos lançamentos financeiros.",
      },
    ],
  }),
  component: GoalsPage,
});

const TYPES: { value: Goal["goal_type"]; label: string }[] = [
  { value: "faturamento", label: "Faturamento" },
  { value: "lucro", label: "Lucro" },
  { value: "reducao_despesas", label: "Redução de despesas" },
  { value: "crescimento", label: "Crescimento" },
];

const now = new Date();

const emptyGoal = {
  id: "",
  title: "",
  goal_type: "faturamento" as Goal["goal_type"],
  target_amount: "",
  period_month: String(now.getMonth() + 1),
  period_year: String(now.getFullYear()),
};

function GoalsPage() {
  const { orgId, can } = useOrg();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const canEdit = can("goals.edit");
  const canViewFinance = can("finance.view");

  const { data: goals, isLoading } = useGoals(orgId);
  const { data: entries } = useEntries(orgId, canViewFinance);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyGoal);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const progressOf = (goal: Goal) => {
    const revenues = entries?.revenues ?? [];
    const expenses = entries?.expenses ?? [];
    const prefix = goal.period_month
      ? `${goal.period_year}-${`${goal.period_month}`.padStart(2, "0")}`
      : `${goal.period_year}`;
    const inPeriod = (list: typeof revenues) =>
      list.filter((e) => isRealized(e) && e.occurred_on.startsWith(prefix));
    const rev = sumOf(inPeriod(revenues));
    const exp = sumOf(inPeriod(expenses));
    if (goal.goal_type === "faturamento" || goal.goal_type === "crescimento") return rev;
    if (goal.goal_type === "lucro") return rev - exp;
    return exp;
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        org_id: orgId!,
        title: form.title.trim(),
        goal_type: form.goal_type,
        target_amount: Number(form.target_amount.replace(",", ".")),
        period_month: form.period_month === "ano" ? null : Number(form.period_month),
        period_year: Number(form.period_year),
      };
      if (form.id) {
        const { error } = await supabase.from("goals").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert(payload);
        if (error) throw error;
      }
      await logActivity(orgId!, user!.id, "meta.salva", "goals", payload.title);
    },
    onSuccess: () => {
      toast.success("Meta salva.");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["goals", orgId] });
    },
    onError: () => toast.error("Não foi possível salvar a meta."),
  });

  const remove = async (goal: Goal) => {
    const { error } = await supabase.from("goals").delete().eq("id", goal.id);
    if (error) {
      toast.error("Não foi possível excluir a meta.");
      return;
    }
    await logActivity(orgId!, user!.id, "meta.excluida", "goals", goal.title);
    void queryClient.invalidateQueries({ queryKey: ["goals", orgId] });
  };

  const list = goals ?? [];
  const atingidas = list.filter((g) => {
    const value = progressOf(g);
    return g.goal_type === "reducao_despesas"
      ? value <= g.target_amount
      : value >= g.target_amount;
  }).length;

  return (
    <AppShell
      title="Metas"
      description="Objetivos mensais e anuais acompanhados automaticamente."
      actions={
        canEdit ? (
          <Button
            onClick={() => {
              setForm(emptyGoal);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Nova meta
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Metas cadastradas" value={String(list.length)} icon={Target} />
        <StatCard label="Metas atingidas" value={String(atingidas)} icon={TrendingUp} tone="positive" />
        <StatCard
          label="Taxa de sucesso"
          value={list.length ? pct((atingidas / list.length) * 100) : "—"}
          icon={TrendingUp}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted lg:col-span-2" />
        ) : list.length ? (
          list.map((goal) => {
            const value = canViewFinance ? progressOf(goal) : 0;
            const ratio = goal.target_amount
              ? Math.min(100, Math.max(0, (value / goal.target_amount) * 100))
              : 0;
            const reached =
              goal.goal_type === "reducao_despesas"
                ? value <= goal.target_amount
                : value >= goal.target_amount;
            return (
              <div key={goal.id} className="surface-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold">{goal.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {TYPES.find((t) => t.value === goal.goal_type)?.label} ·{" "}
                      {goal.period_month
                        ? `${MONTHS_LONG[goal.period_month - 1]} de ${goal.period_year}`
                        : `Ano de ${goal.period_year}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={reached ? "secondary" : "outline"}>
                      {reached ? "Atingida" : "Em andamento"}
                    </Badge>
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => void remove(goal)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <Progress value={ratio} />
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="numeric font-medium">
                      {canViewFinance ? brl(value) : "—"}
                    </span>
                    <span className="numeric text-muted-foreground">
                      meta {brl(goal.target_amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {canViewFinance
                      ? `${pct(ratio)} da meta`
                      : "Sem permissão para ver valores financeiros"}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="lg:col-span-2">
            <EmptyState
              title="Nenhuma meta cadastrada"
              description="Crie metas de faturamento ou lucro para acompanhar o desempenho do comércio."
            />
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova meta</DialogTitle>
            <DialogDescription>
              O progresso é calculado automaticamente pelos lançamentos do período.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ex.: Faturar 50 mil em março"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.goal_type} onValueChange={(v) => set("goal_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor alvo (R$)</Label>
              <Input
                id="valor"
                inputMode="decimal"
                value={form.target_amount}
                onChange={(e) => set("target_amount", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={form.period_month} onValueChange={(v) => set("period_month", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ano">Ano inteiro</SelectItem>
                  {MONTHS_LONG.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ano">Ano</Label>
              <Input
                id="ano"
                inputMode="numeric"
                value={form.period_year}
                onChange={(e) => set("period_year", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.title.trim() || !form.target_amount}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!canEdit && (
        <div className="mt-4">
          <NoPermission what="criar ou editar metas" />
        </div>
      )}
    </AppShell>
  );
}
