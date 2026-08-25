import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";
import { BUSINESS_TYPES } from "@/lib/permissions";
import { useOrg } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/nova-empresa")({
  head: () => ({
    meta: [
      { title: "Cadastrar empresa — Infradata" },
      { name: "description", content: "Informe os dados da sua empresa para começar a usar a Infradata." },
      { property: "og:title", content: "Cadastrar empresa — Infradata" },
      { property: "og:description", content: "Dados básicos da empresa: identificação, contato e porte." },
    ],
  }),
  component: NewOrgPage,
});

function NewOrgPage() {
  const navigate = useNavigate();
  const { setOrgId, refetch } = useOrg();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trade_name: "",
    tax_id: "",
    business_type: "Outro",
    segment: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    country: "Brasil",
    employee_estimate: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_organization", {
      _name: form.name,
      _trade_name: form.trade_name,
      _tax_id: form.tax_id,
      _business_type: form.business_type,
      _segment: form.segment,
      _email: form.email,
      _phone: form.phone,
      _city: form.city,
      _state: form.state,
      _country: form.country || "Brasil",
      _employee_estimate: form.employee_estimate ? Number(form.employee_estimate) : 0,
    });
    setBusy(false);
    if (error || !data) {
      toast.error("Não foi possível cadastrar a empresa.");
      return;
    }
    setOrgId(data as string);
    refetch();
    toast.success("Empresa criada. Você é o administrador.");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Cadastre sua empresa
            </h1>
            <p className="text-sm text-muted-foreground">
              Pedimos apenas o necessário. Você pode ajustar tudo depois.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="surface-card space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da empresa *</Label>
              <Input id="name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade">Nome fantasia</Label>
              <Input id="trade" value={form.trade_name} onChange={(e) => set("trade_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax">CNPJ ou identificador</Label>
              <Input id="tax" value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de negócio</Label>
              <Select value={form.business_type} onValueChange={(v) => set("business_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Input
                id="segment"
                placeholder="Ex.: alimentação, varejo, serviços"
                value={form.segment}
                onChange={(e) => set("segment", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgemail">E-mail empresarial</Label>
              <Input
                id="orgemail"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employees">Quantidade aproximada de funcionários</Label>
              <Input
                id="employees"
                type="number"
                min={0}
                value={form.employee_estimate}
                onChange={(e) => set("employee_estimate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Criar empresa
          </Button>
        </form>
      </div>
    </div>
  );
}
