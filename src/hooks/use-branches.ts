'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/authz';
import { useDashboardSessionOptional } from '@/providers/dashboard-session-provider';

export interface BranchInfo {
  id: string;
  branch_name: string;
  branch_code: string;
}

export function useBranches() {
  const dashboardSession = useDashboardSessionOptional();

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userBranch, setUserBranch] = useState<BranchInfo | null>(null);
  const [userRole, setUserRole] = useState<StaffRole | null>(null);

  useEffect(() => {
    const fetchBranchesAndRole = async () => {
      try {
        const supabase = createBrowserClient();
        const { data: authData } = await supabase.auth.getUser();
        
        if (!authData.user) {
          setLoading(false);
          return;
        }

        // Get user's staff record with branch_id and role
        const { data: staff } = await supabase
          .from('staff')
          .select('id, role, branch_id')
          .eq('auth_user_id', authData.user.id)
          .maybeSingle();

        if (staff) {
          setUserRole(staff.role as StaffRole);

          // Get all branches
          const { data: allBranches } = await supabase
            .from('branches')
            .select('id, branch_name, branch_code')
            .eq('is_active', true)
            .order('branch_name');

          if (allBranches) {
            setBranches(allBranches);

            // Get user's assigned branch
            if (staff.branch_id) {
              const userBranchData = allBranches.find((b) => b.id === staff.branch_id);
              if (userBranchData) {
                setUserBranch(userBranchData);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBranchesAndRole();
  }, []);

  const effectiveRole = dashboardSession?.role ?? userRole;
  const effectiveUserBranch = (dashboardSession?.userBranch as BranchInfo | null | undefined) ?? userBranch;
  const effectiveAllBranches = useMemo(
    () => ((dashboardSession?.branches as BranchInfo[] | undefined) ?? branches),
    [dashboardSession?.branches, branches]
  );

  const availableBranches = useMemo(() => {
    if (effectiveRole === 'superadmin' || effectiveRole === 'manager') {
      return effectiveAllBranches;
    }
    return effectiveUserBranch ? [effectiveUserBranch] : [];
  }, [effectiveRole, effectiveAllBranches, effectiveUserBranch]);

  const getDefaultBranch = useCallback(() => {
    if (effectiveRole === 'superadmin' || effectiveRole === 'manager') {
      const headOffice = effectiveAllBranches.find((b) => b.branch_code === 'HO');
      return headOffice || effectiveAllBranches[0];
    }
    return effectiveUserBranch;
  }, [effectiveAllBranches, effectiveRole, effectiveUserBranch]);

  return {
    branches: availableBranches,
    userBranch: effectiveUserBranch,
    userRole: effectiveRole,
    loading: dashboardSession?.loading ?? loading,
    getDefaultBranch,
  };
}
