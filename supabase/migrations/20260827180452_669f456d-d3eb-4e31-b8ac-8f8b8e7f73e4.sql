CREATE OR REPLACE FUNCTION public.has_perm(_org uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_allowed_account() OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org AND m.user_id = auth.uid()
      AND (m.role = 'admin' OR _perm = ANY(m.permissions))
  ) AND false;
$function$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_allowed_account();
$function$;

CREATE OR REPLACE FUNCTION public.shares_org(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_allowed_account();
$function$;