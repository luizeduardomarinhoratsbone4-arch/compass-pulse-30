import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Building2,
  Database,
  ChevronsUpDown,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org";
import { isAllowedEmail } from "@/lib/access";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { ROLE_LABEL } from "@/lib/permissions";
import { GlobalSearch } from "@/components/GlobalSearch";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/fluxo-de-caixa", label: "Fluxo de Caixa", icon: LineChart },
  { to: "/equipe", label: "Equipe", icon: Users },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/banco-de-dados", label: "Banco de Dados", icon: Database },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/seguranca", label: "Segurança", icon: Shield },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export const IDLE_KEY = "infradata.idleMinutes";

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1">
      <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Building2 className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-base font-semibold text-sidebar-foreground">Infradata</p>
        <p className="text-[11px] text-sidebar-foreground/60">Gestão e dados</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const { user } = useSession();
  const { membership } = useOrg();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }, [navigate, queryClient]);

  // Logout automático por inatividade (configurável em Segurança)
  useEffect(() => {
    const minutes = Number(window.localStorage.getItem(IDLE_KEY) ?? "30");
    if (!minutes || minutes <= 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void signOut(), minutes * 60_000);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [signOut]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = useMemo(() => {
    const source = (user?.user_metadata?.["full_name"] as string) || user?.email || "?";
    return source.slice(0, 2).toUpperCase();
  }, [user]);

  if (user && !isAllowedEmail(user.email)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="surface-card max-w-md p-8 text-center">
          <h1 className="font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta conta não tem permissão para acessar a plataforma. Entre com a conta
            autorizada da Infradata.
          </p>
          <Button className="mt-6" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="border-b border-sidebar-border px-3 py-4">
        <Brand />
      </div>
      <NavLinks onNavigate={() => setMobileOpen(false)} />
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent">
              <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-sidebar-foreground">
                  {user?.email}
                </p>
                <p className="text-[11px] text-sidebar-foreground/60">
                  {membership ? ROLE_LABEL[membership.role] : "—"}
                </p>
              </div>
              <ChevronsUpDown className="size-4 text-sidebar-foreground/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Conta</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => navigate({ to: "/configuracoes" })}>
              <Settings className="mr-2 size-4" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate({ to: "/seguranca" })}>
              <Shield className="mr-2 size-4" /> Segurança
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut className="mr-2 size-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border lg:block">
        {sidebar}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-sidebar-border p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>

          <button
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
          >
            <Search className="size-4" />
            Buscar…
            <kbd className="ml-auto rounded border border-border px-1.5 text-[10px]">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <OrgSwitcher className="hidden sm:inline-flex" />
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="md:hidden">
              <Search className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Notificações">
              <Link to="/notificacoes">
                <Bell className="size-5" />
              </Link>
            </Button>
          </div>
        </header>

        <main className="px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  {title}
                </h1>
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
                <div className="mt-3">
                  <OrgSwitcher />
                </div>
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children}
          </div>
        </main>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
