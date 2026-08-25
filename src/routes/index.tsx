import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, Loader2, LockKeyhole, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — Infradata | Gestão financeira para comércios" },
      {
        name: "description",
        content:
          "Acesse a Infradata: painel de lucro, faturamento, despesas, fluxo de caixa e equipe da sua empresa em um só lugar.",
      },
      { property: "og:title", content: "Infradata — Gestão e dados para comércios" },
      {
        property: "og:description",
        content:
          "Controle financeiro, equipe, metas e relatórios com isolamento total de dados por empresa.",
      },
    ],
  }),
  component: LoginPage,
});

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="auth-gradient relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <span className="font-display text-xl font-semibold text-sidebar-foreground">
            Infradata
          </span>
        </div>

        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight text-sidebar-foreground">
            Dados complexos viram decisões simples.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-foreground/70">
            Faturamento, lucro, despesas, fluxo de caixa e equipe — organizados em um painel único,
            com isolamento total dos dados de cada empresa.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-sidebar-foreground/80">
            {[
              { icon: ShieldCheck, text: "Acesso por função e permissões granulares" },
              { icon: LockKeyhole, text: "Autorização validada no servidor, sempre" },
              { icon: TrendingUp, text: "Indicadores mensais e anuais em tempo real" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3">
                <item.icon className="size-[18px] text-sidebar-primary" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/50">
          Plataforma de gestão empresarial · Infradata
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-5" />
            </div>
            <span className="font-display text-lg font-semibold">Infradata</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login")
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente novamente.",
      );
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  const googleSignIn = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <AuthLayout title="Entrar na plataforma" subtitle="Acesse o painel da sua empresa.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              to="/recuperar-senha"
              className="text-xs font-medium text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          ENTRAR
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

      <Button variant="secondary" className="mt-3 w-full" asChild>
        <Link to="/cadastro">CRIAR MINHA EMPRESA</Link>
      </Button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Ao continuar você concorda com os{" "}
        <Link to="/termos" className="underline hover:text-foreground">
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link to="/privacidade" className="underline hover:text-foreground">
          Política de privacidade
        </Link>
        .
      </p>
    </AuthLayout>
  );
}
