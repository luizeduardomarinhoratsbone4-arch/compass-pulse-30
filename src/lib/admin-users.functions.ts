import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALLOWED_EMAIL } from "@/lib/access";

export type AdminUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  provider: string;
};

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    const email = String(context.claims["email"] ?? "").trim().toLowerCase();
    if (email !== ALLOWED_EMAIL) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw error;

    return data.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "—",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        confirmedAt: (u.email_confirmed_at ?? u.confirmed_at) ?? null,
        provider: (u.app_metadata?.["provider"] as string) ?? "email",
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
