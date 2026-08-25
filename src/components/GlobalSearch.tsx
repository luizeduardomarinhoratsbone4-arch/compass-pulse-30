import { useNavigate } from "@tanstack/react-router";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useEmployees, useEntries } from "@/hooks/useFinanceData";
import { brl, formatDate } from "@/lib/format";
import { useOrg } from "@/lib/org";

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { orgId, can } = useOrg();
  const { data: entries } = useEntries(orgId, can("finance.view") && open);
  const { data: employees } = useEmployees(orgId, can("employees.view") && open);

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar funcionários, receitas, despesas, páginas…" />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Páginas">
          {[
            ["Dashboard", "/dashboard"],
            ["Financeiro", "/financeiro"],
            ["Fluxo de Caixa", "/fluxo-de-caixa"],
            ["Equipe", "/equipe"],
            ["Metas", "/metas"],
            ["Relatórios", "/relatorios"],
            ["Notificações", "/notificacoes"],
            ["Segurança", "/seguranca"],
            ["Configurações", "/configuracoes"],
          ].map(([label, to]) => (
            <CommandItem key={to} value={`pagina ${label}`} onSelect={() => go(to!)}>
              {label}
            </CommandItem>
          ))}
        </CommandGroup>

        {!!employees?.length && (
          <CommandGroup heading="Funcionários">
            {employees.slice(0, 20).map((e) => (
              <CommandItem
                key={e.id}
                value={`func ${e.full_name} ${e.job_title ?? ""} ${e.department ?? ""}`}
                onSelect={() => go(`/equipe/${e.id}`)}
              >
                <span>{e.full_name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {e.job_title ?? "—"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!entries?.revenues.length && (
          <CommandGroup heading="Receitas">
            {entries.revenues.slice(0, 15).map((r) => (
              <CommandItem
                key={r.id}
                value={`receita ${r.description ?? ""} ${r.category}`}
                onSelect={() => go("/financeiro")}
              >
                <span>{r.description || r.category}</span>
                <span className="ml-auto text-xs text-muted-foreground numeric">
                  {brl(r.amount)} · {formatDate(r.occurred_on)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!!entries?.expenses.length && (
          <CommandGroup heading="Despesas">
            {entries.expenses.slice(0, 15).map((r) => (
              <CommandItem
                key={r.id}
                value={`despesa ${r.description ?? ""} ${r.category}`}
                onSelect={() => go("/financeiro")}
              >
                <span>{r.description || r.category}</span>
                <span className="ml-auto text-xs text-muted-foreground numeric">
                  {brl(r.amount)} · {formatDate(r.occurred_on)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
