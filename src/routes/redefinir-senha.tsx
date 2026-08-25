import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/routes/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Definir nova senha — Infradata" },
      { name: "description", content: "Crie uma nova senha para sua conta Infradata." },
      { property: "og:title", content: "Definir nova senha — Infradata" },
      { property: "og:description", content: "Conclua a redefinição de senha da sua conta." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Use ao menos 8 caracteres.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("Link expirado ou inválido. Solicite outro e-mail.");
      return;
    }
    toast.success("Senha atualizada.");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha uma senha forte e exclusiva.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <Input
            id="confirm"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  );
}
