'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StaffRepository } from '@/infrastructure/repositories';
import type { Staff, StaffFormData } from '@/types';

export function useStaff(roleFilter?: string) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const repo = useMemo(() => new StaffRepository(supabase), [supabase]);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const data = await repo.findAll({ role: roleFilter, isActive: true });
      setStaff(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch staff');
    } finally {
      setLoading(false);
    }
  }, [repo, roleFilter]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const getStaffMember = useCallback((id: string) => repo.findById(id), [repo]);

  const createStaffMember = useCallback(async (formData: StaffFormData) => {
    const data = await repo.create(formData);
    await fetchStaff();
    return data;
  }, [repo, fetchStaff]);

  const updateStaffMember = useCallback(async (id: string, formData: Partial<StaffFormData>) => {
    const data = await repo.update(id, formData);
    await fetchStaff();
    return data;
  }, [repo, fetchStaff]);

  const getTechnicians = useCallback(() => repo.findTechnicians(), [repo]);

  return { staff, loading, error, fetchStaff, getStaffMember, createStaffMember, updateStaffMember, getTechnicians };
}
