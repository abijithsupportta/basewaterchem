'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createBrowserClient } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/authz';

export interface DashboardBranchInfo {
  id: string;
  branch_name: string;
  branch_code: string;
}

type SessionState = {
  user: User | null;
  role: StaffRole | null;
  staffId: string | null;
  branchId: string | null;
  branches: DashboardBranchInfo[];
  userBranch: DashboardBranchInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DashboardSessionContext = createContext<SessionState | null>(null);

function isStaffRole(value: unknown): value is StaffRole {
  return value === 'superadmin' || value === 'manager' || value === 'staff' || value === 'technician';
}

export function DashboardSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<DashboardBranchInfo[]>([]);
  const [userBranch, setUserBranch] = useState<DashboardBranchInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createBrowserClient();
    setLoading(true);

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      setUser(authUser ?? null);

      if (!authUser) {
        setRole(null);
        setStaffId(null);
        setBranchId(null);
        setBranches([]);
        setUserBranch(null);
        return;
      }

      const { data: staff } = await supabase
        .from('staff')
        .select('id, role, branch_id')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      const staffRole = isStaffRole(staff?.role) ? (staff.role as StaffRole) : null;
      const metadataRole = isStaffRole(authUser.user_metadata?.role)
        ? (authUser.user_metadata.role as StaffRole)
        : null;
      const effectiveRole = staffRole ?? metadataRole;

      setRole(effectiveRole);
      setStaffId(staff?.id ?? null);
      setBranchId(staff?.branch_id ?? null);

      if (effectiveRole === 'superadmin' || effectiveRole === 'manager') {
        const { data: allBranches } = await supabase
          .from('branches')
          .select('id, branch_name, branch_code')
          .eq('is_active', true)
          .order('branch_name');

        const nextBranches = (allBranches as DashboardBranchInfo[] | null) ?? [];
        setBranches(nextBranches);

        const selectedUserBranch =
          staff?.branch_id ? nextBranches.find((branch) => branch.id === staff.branch_id) ?? null : null;
        setUserBranch(selectedUserBranch);
      } else if (staff?.branch_id) {
        const { data: branch } = await supabase
          .from('branches')
          .select('id, branch_name, branch_code')
          .eq('id', staff.branch_id)
          .maybeSingle();

        const branchInfo = (branch as DashboardBranchInfo | null) ?? null;
        setUserBranch(branchInfo);
        setBranches(branchInfo ? [branchInfo] : []);
      } else {
        setUserBranch(null);
        setBranches([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();

    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo<SessionState>(
    () => ({ user, role, staffId, branchId, branches, userBranch, loading, refresh }),
    [user, role, staffId, branchId, branches, userBranch, loading, refresh]
  );

  return <DashboardSessionContext.Provider value={value}>{children}</DashboardSessionContext.Provider>;
}

export function useDashboardSessionOptional() {
  return useContext(DashboardSessionContext);
}

export function useDashboardSession() {
  const value = useDashboardSessionOptional();
  if (!value) {
    throw new Error('useDashboardSession must be used inside DashboardSessionProvider');
  }
  return value;
}
