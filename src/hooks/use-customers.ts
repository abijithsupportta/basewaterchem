'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomerRepository } from '@/infrastructure/repositories';
import type { Customer, CustomerFormData } from '@/types';
import { useBranchSelection } from '@/hooks/use-branch-selection';

export function useCustomers(
  searchQueryOrOptions?: string | { search?: string; page?: number; pageSize?: number }
) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const supabase = createClient();
  const repo = useMemo(() => new CustomerRepository(supabase), [supabase]);
  const { selectedBranchId } = useBranchSelection();

  const searchQuery = typeof searchQueryOrOptions === 'string'
    ? searchQueryOrOptions
    : searchQueryOrOptions?.search;
  const page = typeof searchQueryOrOptions === 'string'
    ? 1
    : searchQueryOrOptions?.page ?? 1;
  const pageSize = typeof searchQueryOrOptions === 'string'
    ? 1000
    : searchQueryOrOptions?.pageSize ?? 1000;

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count } = await repo.findAll({
        isActive: true,
        search: searchQuery,
        branchId: selectedBranchId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setCustomers(data);
      setTotalCount(count);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [repo, searchQuery, selectedBranchId, page, pageSize]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const getCustomer = useCallback((id: string) => repo.findById(id), [repo]);

  const createCustomer = useCallback(async (formData: CustomerFormData) => {
    // Include the selected branch if not explicitly provided
    const dataWithBranch = {
      ...formData,
      branch_id: formData.branch_id || selectedBranchId,
    };
    const data = await repo.create(dataWithBranch);
    // Add to local state immediately instead of refetching all
    setCustomers((prev) => [data as Customer, ...prev]);
    return data;
  }, [repo, selectedBranchId]);

  const updateCustomer = useCallback(async (id: string, formData: Partial<CustomerFormData>) => {
    const data = await repo.update(id, formData);
    // Update local state immediately
    setCustomers((prev) => prev.map((c) => (c.id === id ? (data as Customer) : c)));
    return data;
  }, [repo]);

  const deleteCustomer = useCallback(async (id: string) => {
    await repo.delete(id);
    // Remove from local state immediately
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, [repo]);

  return { customers, loading, error, totalCount, fetchCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
}
