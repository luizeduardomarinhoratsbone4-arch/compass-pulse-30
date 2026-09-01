import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { listAppUsers } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Contas e acessos | Infradata" },
      {
        name: "description",
        content: "Painel de administração: veja quais e-mails criaram conta e quando entraram.",
      },
      { property: "og:title", content: "Admin — Contas e acessos | Infradata" },
      {
        property: "og:description",
        content: "Acompanhe novos cadastros e últimos acessos da plataforma.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const fetchUsers = useServerFn(listAppUsers);
  const [term, setTerm] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
  });

  const users = useMemo(() => {
    const q = term.trim().toLowerCase();
    const list = data ?? [];
    return q ? list.filter((u) => u.email.toLowerCase().includes(q)) : list;
  }, [data, term]);

  const last24h = useMemo(() => {
    const limit = Date.now() - 24 * 60 * 60 * 1000;
    return (data ?? []).filter((u) => new Date(u.createdAt).getTime() >= limit).length;
  }, [data]);

  return (
    <AppShell
      title="Administração"
      description="Contas que se cadastraram e acessaram a plataforma."
      actions={
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
          Atualizar
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card flex items-center gap-3 p-4">
          <Users className="size-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Contas totais</p>
            <p className="font-display text-xl font-semibold">{data?.length ?? 0}</p>
          </div>
        </div>
        <div className="surface-card flex items-center gap-3 p-4">
          <UserPlus className="size-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Novas em 24h</p>
            <p className="font-display text-xl font-semibold">{last24h}</p>
          </div>
        </div>
        <div className="surface-card flex items-center gap-3 p-4">
          <ShieldCheck className="size-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Confirmadas</p>
            <p className="font-display text-xl font-semibold">
              {(data ?? []).filter((u) => u.confirmedAt).length}
            </p>
          </div>
        </div>
      </div>

      <div className="surface-card mt-6 p-4">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por e-mail…"
          className="max-w-sm"
        />

        {error && (
          <p className="mt-4 text-sm text-destructive">
            Não foi possível carregar as contas: {(error as Error).message}
          </p>
        )}

        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : users.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Nenhuma conta encontrada" description="Nada para exibir aqui." />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">E-mail</th>
                  <th className="py-2 pr-4 font-medium">Cadastro</th>
                  <th className="py-2 pr-4 font-medium">Último acesso</th>
                  <th className="py-2 pr-4 font-medium">Login</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{u.email}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {u.lastSignInAt ? formatDateTime(u.lastSignInAt) : "nunca entrou"}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{u.provider}</td>
                    <td className="py-2.5">
                      <Badge variant={u.confirmedAt ? "secondary" : "outline"}>
                        {u.confirmedAt ? "confirmado" : "pendente"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
