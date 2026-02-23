'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/authz';

export interface BranchInfo {
  id: string;
  branch_name: string;
  branch_code: string;
}

export function useBranches() {
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

  const getAvailableBranches = useCallback(() => {
    // Superadmin and manager can see all branches
    if (userRole === 'superadmin' || userRole === 'manager' || userRole === 'admin') {
      return branches;
    }
    // Other staff can only see their assigned branch
    return userBranch ? [userBranch] : [];
  }, [branches, userBranch, userRole]);

  const getDefaultBranch = useCallback(() => {
    // Superadmin and manager default to "Head Office" or first branch
    if (userRole === 'superadmin' || userRole === 'manager' || userRole === 'admin') {
      const headOffice = branches.find((b) => b.branch_code === 'HO');
      return headOffice || branches[0];
    }
    // Other staff default to their assigned branch
    return userBranch;
  }, [branches, userBranch, userRole]);

  return {
    branches: getAvailableBranches(),
    userBranch,
    userRole,
    loading,
    getDefaultBranch,
  };
}
