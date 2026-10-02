CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 3 AND 120),
  category text NOT NULL DEFAULT 'Problema técnico' CHECK (category IN ('Problema técnico', 'Dúvida', 'Financeiro', 'Sugestão', 'Outro')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_atendimento', 'resolvido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_tickets_select" ON public.support_tickets FOR SELECT TO authenticated USING (public.is_allowed_account() OR (created_by = auth.uid() AND public.is_org_member(org_id)));
CREATE POLICY "support_tickets_insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY "support_tickets_update_admin" ON public.support_tickets FOR UPDATE TO authenticated USING (public.is_allowed_account()) WITH CHECK (public.is_allowed_account());

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_messages_select" ON public.support_messages FOR SELECT TO authenticated USING (
  public.is_allowed_account() OR EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.created_by = auth.uid() AND public.is_org_member(t.org_id)
  )
);
CREATE POLICY "support_messages_insert" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND (
    public.is_allowed_account() OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.created_by = auth.uid() AND public.is_org_member(t.org_id)
    )
  )
);

CREATE INDEX support_tickets_org_id_idx ON public.support_tickets(org_id);
CREATE INDEX support_tickets_created_by_idx ON public.support_tickets(created_by);
CREATE INDEX support_tickets_updated_at_idx ON public.support_tickets(updated_at DESC);
CREATE INDEX support_messages_ticket_created_idx ON public.support_messages(ticket_id, created_at);

CREATE OR REPLACE FUNCTION public.touch_support_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_support_ticket() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_support_ticket() TO service_role;
CREATE TRIGGER support_message_touches_ticket
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_support_ticket();