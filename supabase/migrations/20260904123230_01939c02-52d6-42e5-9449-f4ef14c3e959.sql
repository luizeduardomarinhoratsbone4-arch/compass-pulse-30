-- 1) Corrige has_perm (o "AND false" anulava as permissões reais)
CREATE OR REPLACE FUNCTION public.has_perm(_org uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_allowed_account() OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org AND m.user_id = auth.uid()
      AND (m.role = 'admin' OR _perm = ANY(m.permissions))
  );
$$;

-- 2) Membro real da organização
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_allowed_account() OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org AND m.user_id = auth.uid()
  );
$$;

-- 3) Colegas: precisa compartilhar organização
CREATE OR REPLACE FUNCTION public.shares_org(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_allowed_account() OR EXISTS (
    SELECT 1
    FROM public.organization_members me
    JOIN public.organization_members other ON other.org_id = me.org_id
    WHERE me.user_id = auth.uid() AND other.user_id = _user
  );
$$;

-- 4) Nenhum acesso anônimo (sem login) a nenhuma tabela
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- 5) Funções internas só para usuários autenticados
REVOKE EXECUTE ON FUNCTION public.has_perm(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.shares_org(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_allowed_account() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.default_permissions(public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.add_member_by_email(uuid, text, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_organization(text, text, text, text, text, text, text, text, text, text, integer) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_perm(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_allowed_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_permissions(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_member_by_email(uuid, text, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text, text, text, text, text, text, text, text, integer) TO authenticated;