import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import type { PermissionKey } from "@/lib/permissions";

export type Organization = {
  id: string;
  name: string;
  trade_name: string | null;
  tax_id: string | null;
  business_type: string;
  segment: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string;
  employee_estimate: number | null;
  created_by: string;
  created_at: string;
};

export type Membership = {
  id: string;
  org_id: string;
  user_id: string;
  role: "admin" | "financeiro" | "rh" | "colaborador";
  permissions: string[];
  organizations: Organization | null;
};

type OrgState = {
  memberships: Membership[];
  membership: Membership | null;
  org: Organization | null;
  orgId: string | null;
  loading: boolean;
  setOrgId: (id: string) => void;
  can: (perm: PermissionKey) => boolean;
  refetch: () => void;
};

const OrgContext = createContext<OrgState>({
  memberships: [],
  membership: null,
  org: null,
  orgId: null,
  loading: true,
  setOrgId: () => {},
  can: () => false,
  refetch: () => {},
});

const STORAGE_KEY = "infradata.activeOrg";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const query = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, org_id, user_id, role, permissions, organizations(*)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const memberships = query.data ?? [];
  const membership =
    memberships.find((m) => m.org_id === selected) ?? memberships[0] ?? null;

  const value = useMemo<OrgState>(
    () => ({
      memberships,
      membership,
      org: membership?.organizations ?? null,
      orgId: membership?.org_id ?? null,
      loading: query.isLoading,
      setOrgId: (id: string) => {
        window.localStorage.setItem(STORAGE_KEY, id);
        setSelected(id);
      },
      can: (perm: PermissionKey) =>
        !!membership &&
        (membership.role === "admin" || (membership.permissions ?? []).includes(perm)),
      refetch: () => void query.refetch(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memberships, membership, query.isLoading],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export const useOrg = () => useContext(OrgContext);
