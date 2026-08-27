CREATE OR REPLACE FUNCTION public.is_allowed_account()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'infradata.bets@gmail.com';
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_allowed_account() AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.org_id = _org AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_perm(_org uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_allowed_account() AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org AND m.user_id = auth.uid()
      AND (m.role = 'admin' OR _perm = ANY(m.permissions))
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_org(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_allowed_account() AND EXISTS (
    SELECT 1 FROM public.organization_members a
    JOIN public.organization_members b ON a.org_id = b.org_id
    WHERE a.user_id = auth.uid() AND b.user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.create_organization(_name text, _trade_name text, _tax_id text, _business_type text, _segment text, _email text, _phone text, _city text, _state text, _country text, _employee_estimate integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _org UUID; _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_allowed_account() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  IF _name IS NULL OR length(btrim(_name)) < 2 THEN RAISE EXCEPTION 'nome invalido'; END IF;

  INSERT INTO public.organizations (name, trade_name, tax_id, business_type, segment, email, phone, city, state, country, employee_estimate, created_by)
  VALUES (btrim(_name), _trade_name, _tax_id, coalesce(_business_type,'outro'), _segment, _email, _phone, _city, _state, coalesce(_country,'Brasil'), _employee_estimate, _uid)
  RETURNING id INTO _org;

  INSERT INTO public.organization_members (org_id, user_id, role, permissions)
  VALUES (_org, _uid, 'admin', public.default_permissions('admin'));

  INSERT INTO public.categories (org_id, name, kind)
  SELECT _org, c, 'receita' FROM unnest(ARRAY['Vendas','Serviços','Outras receitas']) c;
  INSERT INTO public.categories (org_id, name, kind)
  SELECT _org, c, 'despesa' FROM unnest(ARRAY['Aluguel','Salários','Fornecedores','Produtos','Marketing','Impostos','Energia','Água','Internet','Transporte','Manutenção','Outros']) c;

  INSERT INTO public.audit_logs (org_id, user_id, action, entity, detail)
  VALUES (_org, _uid, 'organizacao.criada', 'organizations', btrim(_name));

  RETURN _org;
END; $function$;

DROP POLICY IF EXISTS orgs_insert_own ON public.organizations;
CREATE POLICY orgs_insert_own ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_allowed_account());

DROP POLICY IF EXISTS orgs_delete_owner ON public.organizations;
CREATE POLICY orgs_delete_owner ON public.organizations FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND public.is_allowed_account());

DROP POLICY IF EXISTS profiles_select_self_or_colleagues ON public.profiles;
CREATE POLICY profiles_select_self_or_colleagues ON public.profiles FOR SELECT TO authenticated
  USING (public.is_allowed_account() AND (id = auth.uid() OR public.shares_org(id)));

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND public.is_allowed_account());

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.is_allowed_account())
  WITH CHECK (id = auth.uid() AND public.is_allowed_account());