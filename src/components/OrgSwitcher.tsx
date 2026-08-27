import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";

export function OrgSwitcher({ className }: { className?: string }) {
  const { memberships, org, setOrgId } = useOrg();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("max-w-[240px]", className)}>
          <Building2 className="mr-2 size-4 shrink-0" />
          <span className="truncate">{org?.name ?? "Selecionar empresa"}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Empresas que você administra</DropdownMenuLabel>
        {memberships.length === 0 && (
          <DropdownMenuItem disabled>Nenhuma empresa cadastrada</DropdownMenuItem>
        )}
        {memberships.map((m) => (
          <DropdownMenuItem key={m.org_id} onSelect={() => setOrgId(m.org_id)}>
            <span className="truncate">{m.organizations?.name ?? "Empresa"}</span>
            {m.org_id === org?.id && <Check className="ml-auto size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/nova-empresa">
            <Plus className="mr-2 size-4" /> Cadastrar nova empresa
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/configuracoes" })}>
          <Settings className="mr-2 size-4" /> Gerenciar empresa atual
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
