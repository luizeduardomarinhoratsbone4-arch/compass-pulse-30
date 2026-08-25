import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bell, CheckCheck, Info } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { useOrg } from "@/lib/org";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Infradata" },
      {
        name: "description",
        content: "Alertas da sua empresa: metas, despesas elevadas e avisos do sistema.",
      },
      { property: "og:title", content: "Notificações — Infradata" },
      {
        property: "og:description",
        content: "Central de avisos por empresa e por usuário.",
      },
    ],
  }),
  component: NotificationsPage,
});

type Notification = {
  id: string;
  title: string;
  body: string | null;
  level: string;
  read_at: string | null;
  created_at: string;
};

function NotificationsPage() {
  const { orgId } = useOrg();
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", orgId, user?.id],
    enabled: !!orgId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, level, read_at, created_at")
        .eq("org_id", orgId!)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("org_id", orgId!)
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notificações marcadas como lidas.");
      void queryClient.invalidateQueries({ queryKey: ["notifications", orgId, user?.id] });
    },
  });

  const list = data ?? [];
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <AppShell
      title="Notificações"
      description="Avisos e alertas relacionados a esta empresa."
      actions={
        unread ? (
          <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck className="mr-2 size-4" />
            Marcar todas como lidas
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : list.length ? (
        <div className="space-y-3">
          {list.map((n) => {
            const Icon =
              n.level === "alerta" ? AlertTriangle : n.level === "info" ? Info : Bell;
            return (
              <div
                key={n.id}
                className={cn(
                  "surface-card flex items-start gap-3 p-4",
                  !n.read_at && "border-primary/40",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                    n.level === "alerta"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.read_at && <Badge variant="secondary">Nova</Badge>}
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Nenhuma notificação"
          description="Você será avisado aqui sobre metas atingidas, despesas fora do padrão e mudanças importantes."
        />
      )}
    </AppShell>
  );
}
