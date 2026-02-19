'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StaffRepository } from '@/infrastructure/repositories';
import type { Staff, UserRole } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const staffRepo = useMemo(() => new StaffRepository(supabase), [supabase]);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const staffUser = await staffRepo.findByAuthUserId(authUser.id);
          setUser(staffUser);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const staffUser = await staffRepo.findByAuthUserId(session.user.id);
          setUser(staffUser);
        } catch {
          setUser(null);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, staffRepo]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;

  return { user, loading, signIn, signOut, hasRole, isAdmin, isManager, isAdminOrManager };
}
