-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'rh', 'colaborador');
CREATE TYPE public.entry_status AS ENUM ('pendente', 'confirmado', 'cancelado');
CREATE TYPE public.employee_status AS ENUM ('ativo', 'inativo');
CREATE TYPE public.goal_type AS ENUM ('faturamento', 'lucro', 'reducao_despesas', 'crescimento');

-- UPDATED_AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trade_name TEXT,
  tax_id TEXT,
  business_type TEXT NOT NULL DEFAULT 'outro',
  segment TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'Brasil',
  employee_estimate INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- MEMBERS
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'colaborador',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.is_org_member(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = _org AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_perm(_org UUID, _perm TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org AND m.user_id = auth.uid()
      AND (m.role = 'admin' OR _perm = ANY(m.permissions))
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_org(_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members a
    JOIN public.organization_members b ON a.org_id = b.org_id
    WHERE a.user_id = auth.uid() AND b.user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.default_permissions(_role public.app_role)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'admin' THEN ARRAY['finance.view','revenues.edit','expenses.edit','employees.view','employees.edit','salaries.view','salaries.edit','goals.edit','reports.export','users.manage','org.manage','audit.view']
    WHEN 'financeiro' THEN ARRAY['finance.view','revenues.edit','expenses.edit','goals.edit','reports.export']
    WHEN 'rh' THEN ARRAY['employees.view','employees.edit']
    ELSE ARRAY['finance.view']
  END;
$$;

-- PROFILE POLICIES
CREATE POLICY "profiles_select_self_or_colleagues" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_org(id));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ORGANIZATION POLICIES
CREATE POLICY "orgs_select_members" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "orgs_insert_own" ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "orgs_update_managers" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_perm(id, 'org.manage')) WITH CHECK (public.has_perm(id, 'org.manage'));
CREATE POLICY "orgs_delete_owner" ON public.organizations FOR DELETE TO authenticated USING (created_by = auth.uid());

-- MEMBER POLICIES
CREATE POLICY "members_select" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "members_insert" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (public.has_perm(org_id, 'users.manage'));
CREATE POLICY "members_update" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_perm(org_id, 'users.manage')) WITH CHECK (public.has_perm(org_id, 'users.manage'));
CREATE POLICY "members_delete" ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_perm(org_id, 'users.manage') AND user_id <> auth.uid());

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('receita','despesa')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select" ON public.categories FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "categories_write" ON public.categories FOR ALL TO authenticated
  USING (public.has_perm(org_id, 'finance.view')) WITH CHECK (public.has_perm(org_id, 'finance.view'));

-- REVENUES
CREATE TABLE public.revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'Vendas',
  description TEXT,
  payment_method TEXT,
  status public.entry_status NOT NULL DEFAULT 'confirmado',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX revenues_org_date_idx ON public.revenues (org_id, occurred_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenues TO authenticated;
GRANT ALL ON public.revenues TO service_role;
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revenues_select" ON public.revenues FOR SELECT TO authenticated USING (public.has_perm(org_id, 'finance.view'));
CREATE POLICY "revenues_insert" ON public.revenues FOR INSERT TO authenticated WITH CHECK (public.has_perm(org_id, 'revenues.edit'));
CREATE POLICY "revenues_update" ON public.revenues FOR UPDATE TO authenticated
  USING (public.has_perm(org_id, 'revenues.edit')) WITH CHECK (public.has_perm(org_id, 'revenues.edit'));
CREATE POLICY "revenues_delete" ON public.revenues FOR DELETE TO authenticated USING (public.has_perm(org_id, 'revenues.edit'));
CREATE TRIGGER revenues_updated_at BEFORE UPDATE ON public.revenues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'Outros',
  description TEXT,
  payment_method TEXT,
  status public.entry_status NOT NULL DEFAULT 'confirmado',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX expenses_org_date_idx ON public.expenses (org_id, occurred_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT TO authenticated USING (public.has_perm(org_id, 'finance.view'));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.has_perm(org_id, 'expenses.edit'));
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE TO authenticated
  USING (public.has_perm(org_id, 'expenses.edit')) WITH CHECK (public.has_perm(org_id, 'expenses.edit'));
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE TO authenticated USING (public.has_perm(org_id, 'expenses.edit'));
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EMPLOYEES
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  job_title TEXT,
  department TEXT,
  hired_on DATE,
  contract_type TEXT,
  status public.employee_status NOT NULL DEFAULT 'ativo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_select" ON public.employees FOR SELECT TO authenticated USING (public.has_perm(org_id, 'employees.view'));
CREATE POLICY "employees_write" ON public.employees FOR ALL TO authenticated
  USING (public.has_perm(org_id, 'employees.edit')) WITH CHECK (public.has_perm(org_id, 'employees.edit'));
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SALARIES (sensitive, separate table)
CREATE TABLE public.employee_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  monthly_amount NUMERIC(14,2) NOT NULL CHECK (monthly_amount >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX employee_salaries_emp_idx ON public.employee_salaries (employee_id, effective_from DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_salaries TO authenticated;
GRANT ALL ON public.employee_salaries TO service_role;
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salaries_select" ON public.employee_salaries FOR SELECT TO authenticated USING (public.has_perm(org_id, 'salaries.view'));
CREATE POLICY "salaries_write" ON public.employee_salaries FOR ALL TO authenticated
  USING (public.has_perm(org_id, 'salaries.edit')) WITH CHECK (public.has_perm(org_id, 'salaries.edit'));

-- GOALS
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal_type public.goal_type NOT NULL DEFAULT 'faturamento',
  target_amount NUMERIC(14,2) NOT NULL CHECK (target_amount >= 0),
  period_month INTEGER CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_select" ON public.goals FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "goals_write" ON public.goals FOR ALL TO authenticated
  USING (public.has_perm(org_id, 'goals.edit')) WITH CHECK (public.has_perm(org_id, 'goals.edit'));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(org_id))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));

-- AUDIT LOGS (append only)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_org_idx ON public.audit_logs (org_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_perm(org_id, 'audit.view'));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));

-- CREATE ORGANIZATION RPC (bootstraps admin membership + default categories)
CREATE OR REPLACE FUNCTION public.create_organization(
  _name TEXT, _trade_name TEXT, _tax_id TEXT, _business_type TEXT, _segment TEXT,
  _email TEXT, _phone TEXT, _city TEXT, _state TEXT, _country TEXT, _employee_estimate INTEGER
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org UUID; _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
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
END; $$;
REVOKE ALL ON FUNCTION public.create_organization(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER) TO authenticated;

-- ADD MEMBER BY EMAIL (admins only)
CREATE OR REPLACE FUNCTION public.add_member_by_email(_org UUID, _email TEXT, _role public.app_role)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _target UUID;
BEGIN
  IF NOT public.has_perm(_org, 'users.manage') THEN RAISE EXCEPTION 'sem permissao'; END IF;
  SELECT id INTO _target FROM auth.users WHERE lower(email) = lower(btrim(_email)) LIMIT 1;
  IF _target IS NULL THEN RAISE EXCEPTION 'usuario nao encontrado'; END IF;

  INSERT INTO public.organization_members (org_id, user_id, role, permissions)
  VALUES (_org, _target, _role, public.default_permissions(_role))
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions, updated_at = now();

  INSERT INTO public.audit_logs (org_id, user_id, action, entity, detail)
  VALUES (_org, auth.uid(), 'usuario.adicionado', 'organization_members', lower(btrim(_email)));
  RETURN _target;
END; $$;
REVOKE ALL ON FUNCTION public.add_member_by_email(UUID,TEXT,public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_member_by_email(UUID,TEXT,public.app_role) TO authenticated;