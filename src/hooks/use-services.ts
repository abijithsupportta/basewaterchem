'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ServiceRepository } from '@/infrastructure/repositories';
import { ServiceCalculator } from '@/core/services';
import type { Service, ServiceFormData, ServiceCompleteData, ServiceWithDetails } from '@/types';
import { useBranchSelection } from '@/hooks/use-branch-selection';

export function useServices(filters?: {
  status?: string;
  type?: string;
  branchId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  freeOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const [services, setServices] = useState<ServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const supabase = createClient();
  const repo = useMemo(() => new ServiceRepository(supabase), [supabase]);
  const { selectedBranchId } = useBranchSelection();

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const pageSize = filters?.pageSize ?? 20;
      const page = filters?.page ?? 1;
      const { data, count } = await repo.findAll({
        ...filters,
        branchId: selectedBranchId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setServices(data);
      setTotalCount(count);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  }, [
    repo,
    selectedBranchId,
    filters?.status,
    filters?.type,
    filters?.customerId,
    filters?.dateFrom,
    filters?.dateTo,
    filters?.search,
    filters?.freeOnly,
    filters?.page,
    filters?.pageSize,
  ]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const getService = useCallback((id: string) => repo.findById(id), [repo]);

  const createService = useCallback(async (formData: ServiceFormData) => {
    const data = await repo.create(formData);
    await fetchServices();
    return data;
  }, [repo, fetchServices]);

  const updateService = useCallback(async (id: string, formData: Partial<Service>) => {
    const data = await repo.update(id, formData);
    await fetchServices();
    return data;
  }, [repo, fetchServices]);

  const completeService = useCallback(async (id: string, completeData: ServiceCompleteData) => {
    const payload = ServiceCalculator.buildCompletionPayload(completeData);
    const data = await repo.update(id, payload);
    await fetchServices();
    return data;
  }, [repo, fetchServices]);

  return { services, loading, error, totalCount, fetchServices, getService, createService, updateService, completeService };
}

export function useUpcomingServices() {
  const [services, setServices] = useState<ServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const repo = useMemo(() => new ServiceRepository(supabase), [supabase]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await repo.findUpcoming(50);
        setServices(data);
      } catch (err) {
        console.error('Failed to fetch upcoming services:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [repo]);

  return { services, loading };
}
