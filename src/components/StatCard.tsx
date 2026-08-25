import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            tone === "positive" && "bg-success/10 text-success",
            tone === "negative" && "bg-destructive/10 text-destructive",
            tone === "neutral" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p
        className={cn(
          "numeric mt-3 font-display text-2xl font-semibold tracking-tight",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="surface-card flex flex-col items-center justify-center px-6 py-14 text-center">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function NoPermission({ what }: { what: string }) {
  return (
    <div className="surface-card px-6 py-12 text-center">
      <h3 className="font-display text-base font-semibold">Acesso restrito</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Você não tem permissão para {what}. Fale com um administrador da empresa.
      </p>
    </div>
  );
}
