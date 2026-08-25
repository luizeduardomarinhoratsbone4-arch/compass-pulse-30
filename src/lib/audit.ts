import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  orgId: string,
  userId: string,
  action: string,
  entity?: string,
  detail?: string,
) {
  try {
    await supabase.from("audit_logs").insert({
      org_id: orgId,
      user_id: userId,
      action,
      entity: entity ?? null,
      detail: detail ?? null,
    });
  } catch {
    // registro de auditoria não deve quebrar a ação do usuário
  }
}
