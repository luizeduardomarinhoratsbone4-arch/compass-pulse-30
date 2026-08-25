import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Entry = {
  id: string;
  org_id: string;
  amount: number;
  occurred_on: string;
  category: string;
  description: string | null;
  payment_method: string | null;
  status: "pendente" | "confirmado" | "cancelado";
  created_at: string;
};

export type Employee = {
  id: string;
  org_id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  hired_on: string | null;
  contract_type: string | null;
  status: "ativo" | "inativo";
  notes: string | null;
};

export type Salary = {
  id: string;
  org_id: string;
  employee_id: string;
  monthly_amount: number;
  effective_from: string;
};

export type Goal = {
  id: string;
  org_id: string;
  title: string;
  goal_type: "faturamento" | "lucro" | "reducao_despesas" | "crescimento";
  target_amount: number;
  period_month: number | null;
  period_year: number;
};

const num = (v: unknown) => Number(v ?? 0);

export function useEntries(orgId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["entries", orgId],
    enabled: !!orgId && enabled,
    queryFn: async () => {
      const [rev, exp] = await Promise.all([
        supabase
          .from("revenues")
          .select("*")
          .eq("org_id", orgId!)
          .order("occurred_on", { ascending: false }),
        supabase
          .from("expenses")
          .select("*")
          .eq("org_id", orgId!)
          .order("occurred_on", { ascending: false }),
      ]);
      if (rev.error) throw rev.error;
      if (exp.error) throw exp.error;
      return {
        revenues: (rev.data ?? []).map((r) => ({ ...r, amount: num(r.amount) })) as Entry[],
        expenses: (exp.data ?? []).map((r) => ({ ...r, amount: num(r.amount) })) as Entry[],
      };
    },
  });
}

export function useEmployees(orgId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["employees", orgId],
    enabled: !!orgId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("org_id", orgId!)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });
}

export function useSalaries(orgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["salaries", orgId],
    enabled: !!orgId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_salaries")
        .select("*")
        .eq("org_id", orgId!)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((s) => ({
        ...s,
        monthly_amount: num(s.monthly_amount),
      })) as Salary[];
    },
  });
}

export function useGoals(orgId: string | null) {
  return useQuery({
    queryKey: ["goals", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("org_id", orgId!)
        .order("period_year", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((g) => ({
        ...g,
        target_amount: num(g.target_amount),
      })) as Goal[];
    },
  });
}

/** Salário vigente por funcionário (registro mais recente). */
export function currentSalaryMap(salaries: Salary[]) {
  const map = new Map<string, number>();
  for (const s of salaries) if (!map.has(s.employee_id)) map.set(s.employee_id, s.monthly_amount);
  return map;
}
