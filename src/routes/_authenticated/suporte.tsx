import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, CheckCircle2, Clock3, LifeBuoy, MessageSquare, Plus, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isAllowedEmail } from "@/lib/access";
import { formatDateTime } from "@/lib/format";
import { useOrg } from "@/lib/org";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte — Infradata" },
      { name: "description", content: "Central de atendimento entre empresas e a equipe Infradata." },
      { property: "og:title", content: "Suporte — Infradata" },
      { property: "og:description", content: "Envie, acompanhe e responda solicitações de suporte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

type Ticket = Database["public"]["Tables"]["support_tickets"]["Row"] & {
  organizations: { name: string } | null;
};
type Message = Database["public"]["Tables"]["support_messages"]["Row"];

const statusLabel: Record<string, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  resolvido: "Resolvido",
};

const priorityLabel: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

function SupportPage() {
  const { user } = useSession();
  const { orgId, org } = useOrg();
  const queryClient = useQueryClient();
  const isAdmin = isAllowedEmail(user?.email);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({
    subject: "",
    category: "Problema técnico",
    priority: "normal",
    message: "",
  });

  const ticketsQuery = useQuery({
    queryKey: ["support-tickets", user?.id, isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, organizations(name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  const tickets = ticketsQuery.data ?? [];
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null;

  useEffect(() => {
    if (!selectedId && tickets[0]) setSelectedId(tickets[0].id);
  }, [selectedId, tickets]);

  const messagesQuery = useQuery({
    queryKey: ["support-messages", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selected?.id ?? "")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!orgId || !user?.id) throw new Error("Selecione uma empresa antes de enviar.");
      const { data, error } = await supabase.rpc("submit_support_ticket", {
        _org_id: orgId,
        _subject: form.subject,
        _category: form.category,
        _priority: form.priority,
        _message: form.message,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (id) => {
      setDialogOpen(false);
      setForm({ subject: "", category: "Problema técnico", priority: "normal", message: "" });
      await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setSelectedId(id);
      toast.success("Solicitação enviada.");
    },
    onError: (error) => toast.error(`Não foi possível enviar: ${error.message}`),
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!selected || !user?.id || !reply.trim()) return;
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selected.id,
        sender_id: user.id,
        body: reply.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setReply("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["support-messages", selected?.id] }),
        queryClient.invalidateQueries({ queryKey: ["support-tickets"] }),
      ]);
    },
    onError: (error) => toast.error(`Não foi possível responder: ${error.message}`),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!selected) return;
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["support-tickets"] }),
    onError: (error) => toast.error(`Não foi possível atualizar: ${error.message}`),
  });

  const totals = useMemo(
    () => ({
      open: tickets.filter((ticket) => ticket.status === "aberto").length,
      progress: tickets.filter((ticket) => ticket.status === "em_atendimento").length,
      resolved: tickets.filter((ticket) => ticket.status === "resolvido").length,
    }),
    [tickets],
  );

  return (
    <AppShell
      title="Suporte"
      description={isAdmin ? "Atenda as solicitações enviadas pelas empresas." : "Avise a equipe sobre problemas e acompanhe as respostas."}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!orgId}>
              <Plus className="mr-2 size-4" /> Nova solicitação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova solicitação</DialogTitle>
              <DialogDescription>Mensagem enviada em nome de {org?.name ?? "sua empresa"}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="support-subject">Assunto</Label>
                <Input id="support-subject" maxLength={120} value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Ex.: Não consigo cadastrar um funcionário" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(category) => setForm((current) => ({ ...current, category }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Problema técnico", "Dúvida", "Financeiro", "Sugestão", "Outro"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={(priority) => setForm((current) => ({ ...current, priority }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="support-message">Descreva o problema</Label>
                <Textarea id="support-message" rows={6} maxLength={4000} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder="Conte o que aconteceu e o que você estava tentando fazer." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createTicket.mutate()} disabled={form.subject.trim().length < 3 || !form.message.trim() || createTicket.isPending}>
                <Send className="mr-2 size-4" /> Enviar solicitação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary icon={MessageSquare} label="Abertas" value={totals.open} />
        <Summary icon={Clock3} label="Em atendimento" value={totals.progress} />
        <Summary icon={CheckCircle2} label="Resolvidas" value={totals.resolved} />
      </div>

      <div className="mt-6 grid min-h-[480px] overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[340px_1fr]">
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-4">
            <h2 className="font-display font-semibold">Solicitações</h2>
            <p className="mt-1 text-xs text-muted-foreground">{tickets.length} conversa{tickets.length === 1 ? "" : "s"}</p>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-2">
            {ticketsQuery.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : tickets.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <LifeBuoy className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Nenhuma solicitação</p>
                <p className="mt-1 text-xs text-muted-foreground">As mensagens aparecerão aqui.</p>
              </div>
            ) : tickets.map((ticket) => (
              <Button
                key={ticket.id}
                variant="ghost"
                onClick={() => setSelectedId(ticket.id)}
                className={cn("mb-1 h-auto w-full justify-start px-3 py-3 text-left", selected?.id === ticket.id && "bg-accent")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{ticket.subject}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatDateTime(ticket.updated_at)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="size-3" />
                    <span className="truncate">{ticket.organizations?.name ?? "Empresa"}</span>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {selected ? (
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="font-display font-semibold">{selected.subject}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{selected.organizations?.name ?? "Empresa"}</Badge>
                  <Badge variant="secondary">{selected.category}</Badge>
                  <Badge variant={selected.priority === "urgente" ? "destructive" : "outline"}>{priorityLabel[selected.priority] ?? selected.priority}</Badge>
                </div>
              </div>
              {isAdmin ? (
                <Select value={selected.status} onValueChange={(status) => updateStatus.mutate(status)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <Badge>{statusLabel[selected.status] ?? selected.status}</Badge>}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-muted/25 p-4">
              {(messagesQuery.data ?? []).map((message: Message) => {
                const mine = message.sender_id === user?.id;
                return (
                  <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "border border-border bg-background")}>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{formatDateTime(message.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Escreva uma resposta…" className="min-h-10 resize-none" rows={2} maxLength={4000} />
                <Button size="icon" aria-label="Enviar resposta" onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending}>
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-8 text-center text-sm text-muted-foreground">Selecione ou crie uma solicitação.</div>
        )}
      </div>
    </AppShell>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof MessageSquare; label: string; value: number }) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <Icon className="size-5 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}