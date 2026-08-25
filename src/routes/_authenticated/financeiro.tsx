import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { NoPermission, StatCard } from "@/components/StatCard";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useEntries, type Entry } from "@/hooks/useFinanceData";
import { logActivity } from "@/lib/audit";
import { brl, formatDate, isoDay } from "@/lib/format";
import { isRealized, sumOf } from "@/lib/finance";
import { useOrg } from "@/lib/org";
import { useSession } from "@/lib/session";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  REVENUE_CATEGORIES,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Infradata" },
      {
        name: "description",
        content: "Cadastre e acompanhe receitas e despesas da sua empresa com categorias e status.",
      },
      { property: "og:title", content: "Financeiro — Infradata" },
      {
        property: "og:description",
        content: "Receitas, despesas e resultado operacional calculados a partir dos lançamentos.",
      },
    ],
  }),
  component: FinancePage,
});

type Kind = "receita" | "despesa";

const emptyForm = {
  id: "",
  amount: "",
  occurred_on: isoDay(new Date()),
  category: "",
  description: "",
  payment_method: "",
  status: "confirmado" as Entry["status"],
};

function EntryDialog({
  kind,
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: typeof emptyForm;
  onSaved: () => void;
}) {
  const { orgId } = useOrg();
  const { user } = useSession();
  const [form, setForm] = useState(initial);
  const categories = kind === "receita" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const table = kind === "receita" ? "revenues" : "expenses";
      const payload = {
        org_id: orgId!,
        amount: Number(form.amount.replace(",", ".")),
        occurred_on: form.occurred_on,
        category: form.category || categories[0]!,
        description: form.description || null,
        payment_method: form.payment_method || null,
        status: form.status,
        created_by: user?.id ?? null,
      };
      if (form.id) {
        const { error } = await supabase.from(table).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }
      await logActivity(
        orgId!,
        user!.id,
        form.id ? `${kind}.alterada` : `${kind}.cadastrada`,
        table,
        `${brl(payload.amount)} · ${payload.category}`,
      );
    },
    onSuccess: () => {
      toast.success(kind === "receita" ? "Receita salva." : "Despesa salva.");
      onOpenChange(false);
      onSaved();
    },
    onError: () => toast.error("Não foi possível salvar. Verifique suas permissões."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {form.id ? "Editar" : "Nova"} {kind}
          </DialogTitle>
          <DialogDescription>
            Os valores lançados alimentam o dashboard, o fluxo de caixa e os relatórios.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={form.occurred_on}
              onChange={(e) => set("occurred_on", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.category || categories[0] || ""}
              onValueChange={(v) => set("category", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Forma de pagamento</Label>
            <Select
              value={form.payment_method}
              onValueChange={(v) => set("payment_method", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ex.: Venda de produtos"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.amount}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntryTable({
  kind,
  entries,
  canEdit,
  onEdit,
  onDelete,
}: {
  kind: Kind;
  entries: Entry[];
  canEdit: boolean;
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}) {
  if (!entries.length)
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma {kind} encontrada com os filtros atuais.
      </p>
    );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            {canEdit && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.description || "—"}</TableCell>
              <TableCell>{e.category}</TableCell>
              <TableCell className="numeric">{formatDate(e.occurred_on)}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    e.status === "confirmado"
                      ? "secondary"
                      : e.status === "pendente"
                        ? "outline"
                        : "destructive"
                  }
                >
                  {e.status}
                </Badge>
              </TableCell>
              <TableCell
                className={`numeric text-right font-medium ${
                  kind === "receita" ? "text-success" : "text-destructive"
                }`}
              >
                {kind === "receita" ? "+" : "−"} {brl(e.amount)}
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => onEdit(e)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(e)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FinancePage() {
  const { orgId, can } = useOrg();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const canView = can("finance.view");
  const { data, isLoading } = useEntries(orgId, canView);

  const [tab, setTab] = useState<Kind>("receita");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; initial: typeof emptyForm }>({
    open: false,
    initial: emptyForm,
  });

  const canEdit = tab === "receita" ? can("revenues.edit") : can("expenses.edit");
  const source = tab === "receita" ? (data?.revenues ?? []) : (data?.expenses ?? []);

  const filtered = useMemo(
    () =>
      source.filter((e) => {
        if (search && !`${e.description ?? ""} ${e.category}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (category !== "todas" && e.category !== category) return false;
        if (status !== "todos" && e.status !== status) return false;
        if (from && e.occurred_on < from) return false;
        if (to && e.occurred_on > to) return false;
        return true;
      }),
    [source, search, category, status, from, to],
  );

  const totalRev = sumOf((data?.revenues ?? []).filter(isRealized));
  const totalExp = sumOf((data?.expenses ?? []).filter(isRealized));

  const remove = async (entry: Entry) => {
    const table = tab === "receita" ? "revenues" : "expenses";
    const { error } = await supabase.from(table).delete().eq("id", entry.id);
    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }
    await logActivity(orgId!, user!.id, `${tab}.excluida`, table, brl(entry.amount));
    toast.success("Registro excluído.");
    void queryClient.invalidateQueries({ queryKey: ["entries", orgId] });
  };

  if (!canView) {
    return (
      <AppShell title="Financeiro">
        <NoPermission what="visualizar dados financeiros" />
      </AppShell>
    );
  }

  const categories = tab === "receita" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <AppShell
      title="Financeiro"
      description="Receitas, despesas e resultado calculados sobre os seus lançamentos."
      actions={
        canEdit ? (
          <Button onClick={() => setDialog({ open: true, initial: emptyForm })}>
            <Plus className="mr-2 size-4" />
            Nova {tab}
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturamento total" value={brl(totalRev)} icon={TrendingUp} hint="Receitas confirmadas" />
        <StatCard
          label="Despesas totais"
          value={brl(totalExp)}
          icon={TrendingDown}
          tone="negative"
          hint="Custos e gastos confirmados"
        />
        <StatCard
          label="Resultado operacional"
          value={brl(totalRev - totalExp)}
          icon={Wallet}
          tone={totalRev - totalExp >= 0 ? "positive" : "negative"}
          hint="Receitas − despesas"
        />
        <StatCard
          label="Margem estimada"
          value={totalRev ? `${(((totalRev - totalExp) / totalRev) * 100).toFixed(1)}%` : "—"}
          icon={TrendingUp}
          hint="Estimativa sobre o faturamento"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)} className="mt-6">
        <TabsList>
          <TabsTrigger value="receita">Receitas</TabsTrigger>
          <TabsTrigger value="despesa">Despesas</TabsTrigger>
        </TabsList>

        <div className="surface-card mt-4 p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Input
              placeholder="Buscar descrição ou categoria"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:col-span-2"
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
            ) : (
              <>
                <TabsContent value="receita" className="m-0">
                  <EntryTable
                    kind="receita"
                    entries={filtered}
                    canEdit={canEdit}
                    onEdit={(e) =>
                      setDialog({
                        open: true,
                        initial: {
                          id: e.id,
                          amount: String(e.amount),
                          occurred_on: e.occurred_on,
                          category: e.category,
                          description: e.description ?? "",
                          payment_method: e.payment_method ?? "",
                          status: e.status,
                        },
                      })
                    }
                    onDelete={(e) => void remove(e)}
                  />
                </TabsContent>
                <TabsContent value="despesa" className="m-0">
                  <EntryTable
                    kind="despesa"
                    entries={filtered}
                    canEdit={canEdit}
                    onEdit={(e) =>
                      setDialog({
                        open: true,
                        initial: {
                          id: e.id,
                          amount: String(e.amount),
                          occurred_on: e.occurred_on,
                          category: e.category,
                          description: e.description ?? "",
                          payment_method: e.payment_method ?? "",
                          status: e.status,
                        },
                      })
                    }
                    onDelete={(e) => void remove(e)}
                  />
                </TabsContent>
              </>
            )}
          </div>
        </div>
      </Tabs>

      {dialog.open && (
        <EntryDialog
          key={dialog.initial.id || "new"}
          kind={tab}
          open={dialog.open}
          onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
          initial={dialog.initial}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["entries", orgId] })}
        />
      )}
    </AppShell>
  );
}
