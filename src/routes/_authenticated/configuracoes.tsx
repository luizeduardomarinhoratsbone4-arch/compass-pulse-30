import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, IDLE_KEY } from "@/components/AppShell";
import { NoPermission } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/audit";
import { useOrg } from "@/lib/org";
import { ROLE_LABEL } from "@/lib/permissions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Infradata" },
      {
        name: "description",
        content: "Dados da empresa, usuários, papéis de acesso e preferências de sessão.",
      },
      { property: "og:title", content: "Configurações — Infradata" },
      {
        property: "og:description",
        content: "Administre a empresa, convide usuários e defina permissões por papel.",
      },
    ],
  }),
  component: SettingsPage,
});

type Member = {
  id: string;
  user_id: string;
  role: "admin" | "financeiro" | "rh" | "colaborador";
  profiles?: { full_name: string | null; email: string | null } | null;
};

const ROLES = ["admin", "financeiro", "rh", "colaborador"] as const;

function SettingsPage() {
  const { orgId, org, can, refetch } = useOrg();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const canManageOrg = can("org.manage");
  const canManageUsers = can("users.manage");

  const [orgForm, setOrgForm] = useState({
    name: "",
    trade_name: "",
    tax_id: "",
    segment: "",
    email: "",
    phone: "",
    city: "",
    state: "",
  });
  const [idle, setIdle] = useState("30");
  const [invite, setInvite] = useState({ email: "", role: "colaborador" });

  useEffect(() => {
    if (org)
      setOrgForm({
        name: org.name,
        trade_name: org.trade_name ?? "",
        tax_id: org.tax_id ?? "",
        segment: org.segment ?? "",
        email: org.email ?? "",
        phone: org.phone ?? "",
        city: org.city ?? "",
        state: org.state ?? "",
      });
  }, [org]);

  useEffect(() => {
    setIdle(window.localStorage.getItem(IDLE_KEY) ?? "30");
  }, []);

  const { data: members } = useQuery({
    queryKey: ["members", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role, profiles:profiles(full_name, email)")
        .eq("org_id", orgId!);
      if (error) throw error;
      return (data ?? []) as unknown as Member[];
    },
  });

  const saveOrg = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: orgForm.name.trim(),
          trade_name: orgForm.trade_name || null,
          tax_id: orgForm.tax_id || null,
          segment: orgForm.segment || null,
          email: orgForm.email || null,
          phone: orgForm.phone || null,
          city: orgForm.city || null,
          state: orgForm.state || null,
        })
        .eq("id", orgId!);
      if (error) throw error;
      await logActivity(orgId!, user!.id, "empresa.atualizada", "organizations", orgForm.name);
    },
    onSuccess: () => {
      toast.success("Dados da empresa atualizados.");
      refetch();
    },
    onError: () => toast.error("Não foi possível atualizar a empresa."),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("add_member_by_email", {
        _org: orgId!,
        _email: invite.email.trim(),
        _role: invite.role as Member["role"],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário adicionado à empresa.");
      setInvite({ email: "", role: "colaborador" });
      void queryClient.invalidateQueries({ queryKey: ["members", orgId] });
    },
    onError: () =>
      toast.error("Usuário não encontrado. Peça para a pessoa criar a conta primeiro."),
  });

  const changeRole = async (member: Member, role: Member["role"]) => {
    const { error } = await supabase
      .from("organization_members")
      .update({ role, permissions: [] })
      .eq("id", member.id);
    if (error) {
      toast.error("Não foi possível alterar o papel.");
      return;
    }
    await supabase.rpc("default_permissions", { _role: role }).then(async ({ data }) => {
      if (Array.isArray(data))
        await supabase.from("organization_members").update({ permissions: data }).eq("id", member.id);
    });
    toast.success("Papel atualizado.");
    void queryClient.invalidateQueries({ queryKey: ["members", orgId] });
  };

  const removeMember = async (member: Member) => {
    const { error } = await supabase.from("organization_members").delete().eq("id", member.id);
    if (error) {
      toast.error("Não foi possível remover o usuário.");
      return;
    }
    await logActivity(orgId!, user!.id, "usuario.removido", "organization_members", member.user_id);
    void queryClient.invalidateQueries({ queryKey: ["members", orgId] });
  };

  const set = (k: keyof typeof orgForm, v: string) => setOrgForm((f) => ({ ...f, [k]: v }));

  return (
    <AppShell title="Configurações" description="Empresa, usuários e preferências de sessão.">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="surface-card p-5">
          <h3 className="font-display text-base font-semibold">Dados da empresa</h3>
          {canManageOrg ? (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="nome">Razão social</Label>
                  <Input id="nome" value={orgForm.name} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fantasia">Nome fantasia</Label>
                  <Input
                    id="fantasia"
                    value={orgForm.trade_name}
                    onChange={(e) => set("trade_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ / CPF</Label>
                  <Input id="cnpj" value={orgForm.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seg">Segmento</Label>
                  <Input
                    id="seg"
                    value={orgForm.segment}
                    onChange={(e) => set("segment", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tel">Telefone</Label>
                  <Input id="tel" value={orgForm.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mail">E-mail</Label>
                  <Input id="mail" value={orgForm.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cid">Cidade</Label>
                  <Input id="cid" value={orgForm.city} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uf">Estado</Label>
                  <Input id="uf" value={orgForm.state} onChange={(e) => set("state", e.target.value)} />
                </div>
              </div>
              <Button
                className="mt-4"
                onClick={() => saveOrg.mutate()}
                disabled={saveOrg.isPending || !orgForm.name.trim()}
              >
                Salvar alterações
              </Button>
            </>
          ) : (
            <div className="mt-4">
              <NoPermission what="editar os dados da empresa" />
            </div>
          )}
        </div>

        <div className="surface-card p-5">
          <h3 className="font-display text-base font-semibold">Sessão e segurança</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Encerramento automático da sessão após inatividade.
          </p>
          <div className="mt-4 flex items-end gap-3">
            <div className="space-y-2">
              <Label>Tempo de inatividade</Label>
              <Select
                value={idle}
                onValueChange={(v) => {
                  setIdle(v);
                  window.localStorage.setItem(IDLE_KEY, v);
                  toast.success("Preferência salva.");
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="240">4 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="surface-card mt-4 p-5">
        <h3 className="font-display text-base font-semibold">Usuários da empresa</h3>
        {canManageUsers ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="convite">E-mail do usuário</Label>
              <Input
                id="convite"
                className="w-64"
                placeholder="pessoa@empresa.com"
                value={invite.email}
                onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={invite.role} onValueChange={(v) => setInvite((i) => ({ ...i, role: v }))}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addMember.mutate()} disabled={addMember.isPending || !invite.email}>
              <UserPlus className="mr-2 size-4" />
              Adicionar
            </Button>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                {canManageUsers && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.profiles?.full_name || "—"}
                    {m.user_id === user?.id && (
                      <Badge variant="secondary" className="ml-2">
                        você
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.profiles?.email || "—"}</TableCell>
                  <TableCell>
                    {canManageUsers && m.user_id !== user?.id ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) => void changeRole(m, v as Member["role"])}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r] ?? r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                    )}
                  </TableCell>
                  {canManageUsers && (
                    <TableCell>
                      {m.user_id !== user?.id && (
                        <Button size="icon" variant="ghost" onClick={() => void removeMember(m)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
