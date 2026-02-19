'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Staff, StaffFormData } from '@/types';

export function useStaff(roleFilter?: string) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('staff')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (roleFilter) query = query.eq('role', roleFilter);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setStaff(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, roleFilter]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const getStaffMember = async (id: string) => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  };

  const createStaffMember = async (formData: StaffFormData) => {
    const { data, error } = await supabase
      .from('staff')
      .insert(formData)
      .select()
      .single();
    if (error) throw error;
    await fetchStaff();
    return data;
  };

  const updateStaffMember = async (id: string, formData: Partial<StaffFormData>) => {
    const { data, error } = await supabase
      .from('staff')
      .update(formData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchStaff();
    return data;
  };

  const getTechnicians = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('role', 'technician')
      .eq('is_active', true)
      .order('full_name');
    if (error) throw error;
    return data || [];
  };

  return {
    staff,
    loading,
    error,
    fetchStaff,
    getStaffMember,
    createStaffMember,
    updateStaffMember,
    getTechnicians,
  };
}
