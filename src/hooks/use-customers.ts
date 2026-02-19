'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomerRepository } from '@/infrastructure/repositories';
import type { Customer, CustomerFormData } from '@/types';

export function useCustomers(searchQuery?: string) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const repo = useMemo(() => new CustomerRepository(supabase), [supabase]);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await repo.findAll({ isActive: true, search: searchQuery });
      setCustomers(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [repo, searchQuery]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const getCustomer = useCallback((id: string) => repo.findById(id), [repo]);

  const createCustomer = useCallback(async (formData: CustomerFormData) => {
    const data = await repo.create(formData);
    await fetchCustomers();
    return data;
  }, [repo, fetchCustomers]);

  const updateCustomer = useCallback(async (id: string, formData: Partial<CustomerFormData>) => {
    const data = await repo.update(id, formData);
    await fetchCustomers();
    return data;
  }, [repo, fetchCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    await repo.softDelete(id);
    await fetchCustomers();
  }, [repo, fetchCustomers]);

  return { customers, loading, error, fetchCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
}
