import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/routes/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Infradata" },
      {
        name: "description",
        content: "Receba um link seguro para redefinir a senha da sua conta Infradata.",
      },
      { property: "og:title", content: "Recuperar senha — Infradata" },
      {
        property: "og:description",
        content: "Redefinição de senha por link seguro enviado ao seu e-mail.",
      },
    ],
  }),
  component: RecoverPage,
});

function RecoverPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail agora.");
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Enviaremos um link seguro para você criar uma nova senha."
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          Se existir uma conta para <strong className="text-foreground">{email}</strong>, o link de
          redefinição foi enviado.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Enviar link
          </Button>
        </form>
      )}
      <Button variant="ghost" className="mt-4 w-full" asChild>
        <Link to="/">Voltar para o login</Link>
      </Button>
    </AuthLayout>
  );
}
