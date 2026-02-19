'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AmcRepository } from '@/infrastructure/repositories';
import { AmcContractRules } from '@/core/services';
import type { AmcContract, AmcFormData, AmcContractWithDetails } from '@/types';

export function useAmc(filters?: { status?: string; customerId?: string }) {
  const [contracts, setContracts] = useState<AmcContractWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const repo = useMemo(() => new AmcRepository(supabase), [supabase]);

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await repo.findAll(filters);
      setContracts(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AMC contracts');
    } finally {
      setLoading(false);
    }
  }, [repo, filters?.status, filters?.customerId]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const getContract = useCallback((id: string) => repo.findById(id), [repo]);

  const createContract = useCallback(async (formData: AmcFormData) => {
    const data = await repo.create(formData);
    await fetchContracts();
    return data;
  }, [repo, fetchContracts]);

  const updateContract = useCallback(async (id: string, formData: Partial<AmcContract>) => {
    const data = await repo.update(id, formData);
    await fetchContracts();
    return data;
  }, [repo, fetchContracts]);

  const renewContract = useCallback(async (id: string, newEndDate: string, amount: number) => {
    const payload = AmcContractRules.buildRenewalPayload(newEndDate, amount);
    const data = await repo.update(id, payload);
    await fetchContracts();
    return data;
  }, [repo, fetchContracts]);

  return { contracts, loading, error, fetchContracts, getContract, createContract, updateContract, renewContract };
}
