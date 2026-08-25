REVOKE ALL ON FUNCTION public.is_org_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_perm(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_org(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.default_permissions(public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_organization(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_member_by_email(UUID,TEXT,public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_perm(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_permissions(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_member_by_email(UUID,TEXT,public.app_role) TO authenticated;