import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeDollarSign, Pencil, Plus, Trash2, UserCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  currentSalaryMap,
  useEmployees,
  useSalaries,
  type Employee,
} from "@/hooks/useFinanceData";
import { logActivity } from "@/lib/audit";
import { brl, formatDate, isoDay } from "@/lib/format";
import { useOrg } from "@/lib/org";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — Infradata" },
      {
        name: "description",
        content: "Cadastro de funcionários, cargos, departamentos e histórico de salários.",
      },
      { property: "og:title", content: "Equipe — Infradata" },
      {
        property: "og:description",
        content: "Gestão de equipe com controle de folha salarial e permissões por papel.",
      },
    ],
  }),
  component: TeamPage,
});

const CONTRACTS = ["CLT", "PJ", "Estágio", "Temporário", "Sócio"];

const emptyEmployee = {
  id: "",
  full_name: "",
  job_title: "",
  department: "",
  hired_on: isoDay(new Date()),
  contract_type: "CLT",
  status: "ativo" as Employee["status"],
  notes: "",
  salary: "",
};

function TeamPage() {
  const { orgId, can } = useOrg();
  const { user } = useSession();
  const queryClient = useQueryClient();

  const canView = can("employees.view");
  const canEdit = can("employees.edit");
  const canSeeSalary = can("salaries.view");
  const canEditSalary = can("salaries.edit");

  const { data: employees, isLoading } = useEmployees(orgId, canView);
  const { data: salaries } = useSalaries(orgId, canSeeSalary);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [form, setForm] = useState(emptyEmployee);
  const [open, setOpen] = useState(false);

  const salaryMap = useMemo(() => currentSalaryMap(salaries ?? []), [salaries]);
  const list = (employees ?? []).filter((e) => {
    if (status !== "todos" && e.status !== status) return false;
    if (
      search &&
      !`${e.full_name} ${e.job_title ?? ""} ${e.department ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const ativos = (employees ?? []).filter((e) => e.status === "ativo");
  const folha = ativos.reduce((acc, e) => acc + (salaryMap.get(e.id) ?? 0), 0);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        org_id: orgId!,
        full_name: form.full_name.trim(),
        job_title: form.job_title || null,
        department: form.department || null,
        hired_on: form.hired_on || null,
        contract_type: form.contract_type || null,
        status: form.status,
        notes: form.notes || null,
      };
      let employeeId = form.id;
      if (employeeId) {
        const { error } = await supabase.from("employees").update(payload).eq("id", employeeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("employees")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        employeeId = data.id;
      }

      const salary = Number(form.salary.replace(",", "."));
      if (canEditSalary && form.salary && salary !== (salaryMap.get(employeeId) ?? -1)) {
        const { error } = await supabase.from("employee_salaries").insert({
          org_id: orgId!,
          employee_id: employeeId,
          monthly_amount: salary,
          effective_from: isoDay(new Date()),
        });
        if (error) throw error;
      }

      await logActivity(
        orgId!,
        user!.id,
        form.id ? "funcionario.atualizado" : "funcionario.cadastrado",
        "employees",
        payload.full_name,
      );
    },
    onSuccess: () => {
      toast.success("Funcionário salvo.");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["employees", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["salaries", orgId] });
    },
    onError: () => toast.error("Não foi possível salvar o funcionário."),
  });

  const remove = async (e: Employee) => {
    const { error } = await supabase.from("employees").delete().eq("id", e.id);
    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }
    await logActivity(orgId!, user!.id, "funcionario.excluido", "employees", e.full_name);
    toast.success("Funcionário removido.");
    void queryClient.invalidateQueries({ queryKey: ["employees", orgId] });
  };

  if (!canView) {
    return (
      <AppShell title="Equipe">
        <NoPermission what="visualizar a equipe" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Equipe"
      description="Funcionários, cargos e folha salarial da empresa."
      actions={
        canEdit ? (
          <Button
            onClick={() => {
              setForm(emptyEmployee);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Novo funcionário
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de funcionários" value={String(employees?.length ?? 0)} icon={Users} />
        <StatCard label="Ativos" value={String(ativos.length)} icon={UserCheck} tone="positive" />
        <StatCard
          label="Folha mensal"
          value={canSeeSalary ? brl(folha) : "—"}
          icon={BadgeDollarSign}
          hint={canSeeSalary ? "Somatório dos salários vigentes" : "Sem permissão para ver salários"}
        />
        <StatCard
          label="Custo médio"
          value={canSeeSalary && ativos.length ? brl(folha / ativos.length) : "—"}
          icon={BadgeDollarSign}
        />
      </div>

      <div className="surface-card mt-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            className="md:col-span-3"
            placeholder="Buscar por nome, cargo ou departamento"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          ) : list.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Status</TableHead>
                    {canSeeSalary && <TableHead className="text-right">Salário</TableHead>}
                    {canEdit && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.full_name}</TableCell>
                      <TableCell>{e.job_title || "—"}</TableCell>
                      <TableCell>{e.department || "—"}</TableCell>
                      <TableCell className="numeric">{formatDate(e.hired_on)}</TableCell>
                      <TableCell>{e.contract_type || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === "ativo" ? "secondary" : "outline"}>
                          {e.status}
                        </Badge>
                      </TableCell>
                      {canSeeSalary && (
                        <TableCell className="numeric text-right font-medium">
                          {salaryMap.has(e.id) ? brl(salaryMap.get(e.id)!) : "—"}
                        </TableCell>
                      )}
                      {canEdit && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setForm({
                                  id: e.id,
                                  full_name: e.full_name,
                                  job_title: e.job_title ?? "",
                                  department: e.department ?? "",
                                  hired_on: e.hired_on ?? "",
                                  contract_type: e.contract_type ?? "CLT",
                                  status: e.status,
                                  notes: e.notes ?? "",
                                  salary: salaryMap.has(e.id) ? String(salaryMap.get(e.id)) : "",
                                });
                                setOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => void remove(e)}>
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
          ) : (
            <EmptyState
              title="Nenhum funcionário encontrado"
              description="Cadastre a sua equipe para acompanhar folha salarial e custos por departamento."
            />
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar" : "Novo"} funcionário</DialogTitle>
            <DialogDescription>
              Os salários ficam visíveis apenas para quem tem permissão específica.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input id="cargo" value={form.job_title} onChange={(e) => set("job_title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dep">Departamento</Label>
              <Input
                id="dep"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adm">Admissão</Label>
              <Input
                id="adm"
                type="date"
                value={form.hired_on}
                onChange={(e) => set("hired_on", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select value={form.contract_type} onValueChange={(v) => set("contract_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACTS.map((c) => (
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
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canEditSalary && (
              <div className="space-y-2">
                <Label htmlFor="sal">Salário mensal (R$)</Label>
                <Input
                  id="sal"
                  inputMode="decimal"
                  value={form.salary}
                  onChange={(e) => set("salary", e.target.value)}
                  placeholder="0,00"
                />
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea id="obs" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.full_name.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
