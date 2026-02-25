'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useDashboardSessionOptional } from '@/providers/dashboard-session-provider';

export function useAuth() {
  const dashboardSession = useDashboardSessionOptional();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!dashboardSession) return;
    setUser(dashboardSession.user);
    setLoading(dashboardSession.loading);
  }, [dashboardSession?.user, dashboardSession?.loading, dashboardSession]);

  useEffect(() => {
    if (dashboardSession) return;

    const getUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, dashboardSession]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const role = user?.user_metadata?.role as string | undefined;
  const isAdmin = role === 'superadmin';

  return { user, loading, signIn, signOut, isAdmin };
}
