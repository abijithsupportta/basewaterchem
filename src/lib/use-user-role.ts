import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/authz';
import { useDashboardSessionOptional } from '@/providers/dashboard-session-provider';

const ROLE_CACHE_KEY = 'staff-role-cache';

function isStaffRole(value: unknown): value is StaffRole {
  return (
    value === 'superadmin' ||
    value === 'manager' ||
    value === 'staff' ||
    value === 'technician'
  );
}

function getCachedRole(): StaffRole | null {
  if (typeof window === 'undefined') return null;
  const cached = window.localStorage.getItem(ROLE_CACHE_KEY);
  return isStaffRole(cached) ? cached : null;
}

function setCachedRole(role: StaffRole | null) {
  if (typeof window === 'undefined') return;
  if (!role) {
    window.localStorage.removeItem(ROLE_CACHE_KEY);
    return;
  }
  window.localStorage.setItem(ROLE_CACHE_KEY, role);
}

export function useUserRoleState() {
  const dashboardSession = useDashboardSessionOptional();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dashboardSession) {
      setRole(dashboardSession.role);
      setLoading(dashboardSession.loading);
      return;
    }

    const cachedRole = getCachedRole();
    if (cachedRole) {
      setRole(cachedRole);
      setLoading(false);
    }

    let cancelled = false;
    const supabase = createBrowserClient();

    const resolveRole = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (cancelled) return;

        if (error || !data.user) {
          setRole(null);
          setCachedRole(null);
          return;
        }

        const { data: staff } = await supabase
          .from('staff')
          .select('role')
          .eq('auth_user_id', data.user.id)
          .maybeSingle();

        if (cancelled) return;

        const staffRole = staff?.role;
        if (isStaffRole(staffRole)) {
          setRole(staffRole);
          setCachedRole(staffRole);
          return;
        }

        const metadataRole = data.user.user_metadata?.role;
        if (isStaffRole(metadataRole)) {
          setRole(metadataRole);
          setCachedRole(metadataRole);
          return;
        }

        setRole(null);
        setCachedRole(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void resolveRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      void resolveRole();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [dashboardSession]);

  return { role, loading };
}

export function useUserRole(): StaffRole {
  const { role } = useUserRoleState();
  return role ?? 'staff';
}
