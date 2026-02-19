'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ServiceRepository } from '@/infrastructure/repositories';
import { ServiceCalculator } from '@/core/services';
import type { Service, ServiceFormData, ServiceCompleteData, UpcomingServiceView } from '@/types';

export function useServices(filters?: {
  status?: string;
  type?: string;
  technicianId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const repo = useMemo(() => new ServiceRepository(supabase), [supabase]);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await repo.findAll(filters);
      setServices(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  }, [repo, filters?.status, filters?.type, filters?.technicianId, filters?.customerId, filters?.dateFrom, filters?.dateTo]);

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

  const assignTechnician = useCallback(async (serviceId: string, technicianId: string) => {
    const payload = ServiceCalculator.buildAssignmentPayload(technicianId);
    const data = await repo.update(serviceId, payload);
    await fetchServices();
    return data;
  }, [repo, fetchServices]);

  return { services, loading, error, fetchServices, getService, createService, updateService, completeService, assignTechnician };
}

export function useUpcomingServices() {
  const [services, setServices] = useState<UpcomingServiceView[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const repo = useMemo(() => new ServiceRepository(supabase), [supabase]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await repo.findUpcoming(50);
        setServices(data as unknown as UpcomingServiceView[]);
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
