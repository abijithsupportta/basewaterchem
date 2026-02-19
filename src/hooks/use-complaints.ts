'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ComplaintRepository } from '@/infrastructure/repositories';
import { ComplaintRules } from '@/core/services';
import type { Complaint, ComplaintFormData, ComplaintWithDetails } from '@/types';

export function useComplaints(filters?: { status?: string; priority?: string; customerId?: string }) {
  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const repo = useMemo(() => new ComplaintRepository(supabase), [supabase]);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const data = await repo.findAll(filters);
      setComplaints(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch complaints');
    } finally {
      setLoading(false);
    }
  }, [repo, filters?.status, filters?.priority, filters?.customerId]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const getComplaint = useCallback((id: string) => repo.findById(id), [repo]);

  const createComplaint = useCallback(async (formData: ComplaintFormData) => {
    const data = await repo.create(formData);
    await fetchComplaints();
    return data;
  }, [repo, fetchComplaints]);

  const updateComplaint = useCallback(async (id: string, formData: Partial<Complaint>) => {
    const data = await repo.update(id, formData);
    await fetchComplaints();
    return data;
  }, [repo, fetchComplaints]);

  const resolveComplaint = useCallback(async (id: string, resolutionNotes: string) => {
    const payload = ComplaintRules.buildResolutionPayload(resolutionNotes);
    const data = await repo.update(id, payload);
    await fetchComplaints();
    return data;
  }, [repo, fetchComplaints]);

  return { complaints, loading, error, fetchComplaints, getComplaint, createComplaint, updateComplaint, resolveComplaint };
}
