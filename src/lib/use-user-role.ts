import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/authz';

export function useUserRole(): StaffRole {
  const [role, setRole] = useState<StaffRole>('staff');

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      const supabase = createBrowserClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || cancelled) return;

      const { data: staff } = await supabase
        .from('staff')
        .select('role')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();

      if (!cancelled && staff?.role) {
        setRole(staff.role as StaffRole);
        return;
      }

      const metadataRole = data.user.user_metadata?.role as StaffRole | undefined;
      if (!cancelled && metadataRole) {
        setRole(metadataRole);
      }
    };

    loadRole();

    return () => {
      cancelled = true;
    };
  }, []);

  return role;
}
