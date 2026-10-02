CREATE OR REPLACE FUNCTION public.submit_support_ticket(
  _org_id uuid,
  _subject text,
  _category text,
  _priority text,
  _message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _ticket_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  IF NOT public.is_org_member(_org_id) THEN
    RAISE EXCEPTION 'Empresa não autorizada';
  END IF;

  INSERT INTO public.support_tickets (org_id, created_by, subject, category, priority)
  VALUES (_org_id, auth.uid(), btrim(_subject), _category, _priority)
  RETURNING id INTO _ticket_id;

  INSERT INTO public.support_messages (ticket_id, sender_id, body)
  VALUES (_ticket_id, auth.uid(), btrim(_message));

  RETURN _ticket_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_support_ticket(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_support_ticket(uuid, text, text, text, text) TO authenticated;