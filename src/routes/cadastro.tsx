import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/routes/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar minha empresa — Infradata" },
      {
        name: "description",
        content:
          "Crie sua conta Infradata e cadastre sua empresa para controlar faturamento, lucro, despesas e equipe.",
      },
      { property: "og:title", content: "Criar minha empresa — Infradata" },
      {
        property: "og:description",
        content: "Conta independente por empresa, com dados isolados e permissões por função.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "Este e-mail já possui conta. Faça login."
          : "Não foi possível criar a conta.",
      );
      return;
    }
    if (data.session) {
      navigate({ to: "/nova-empresa", replace: true });
      return;
    }
    setSent(true);
  };

  const googleSignIn = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Não foi possível continuar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/nova-empresa", replace: true });
  };

  if (sent) {
    return (
      <AuthLayout
        title="Verifique seu e-mail"
        subtitle="Enviamos um link de confirmação para concluir o cadastro."
      >
        <p className="text-sm text-muted-foreground">
          Confirme o e-mail <strong className="text-foreground">{email}</strong> e depois entre na
          plataforma para cadastrar os dados da sua empresa.
        </p>
        <Button className="mt-6 w-full" asChild>
          <Link to="/">Voltar para o login</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar minha empresa"
      subtitle="Primeiro sua conta de acesso. Em seguida, os dados da empresa."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Seu nome</Label>
          <Input
            id="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome completo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo de 8 caracteres"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <Input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          CRIAR CONTA
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="w-full" onClick={googleSignIn} disabled={busy}>
        Continuar com Google
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
