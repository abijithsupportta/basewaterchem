'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const inFlightRef = useRef<{
    key: string;
    promise: Promise<{ data: Customer[]; count: number }>;
  } | null>(null);

  const searchQuery = typeof searchQueryOrOptions === 'string'
    ? searchQueryOrOptions
    : searchQueryOrOptions?.search;
  const page = typeof searchQueryOrOptions === 'string'
    ? 1
    : searchQueryOrOptions?.page ?? 1;
  const pageSize = typeof searchQueryOrOptions === 'string'
    ? 100
    : searchQueryOrOptions?.pageSize ?? 100;

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);

      const requestKey = JSON.stringify({
        selectedBranchId,
        search: searchQuery ?? null,
        page,
        pageSize,
      });

      if (inFlightRef.current?.key === requestKey) {
        const pending = await inFlightRef.current.promise;
        setCustomers(pending.data);
        setTotalCount(pending.count);
        setError(null);
        return;
      }

      const promise = repo.findAll({
        isActive: true,
        search: searchQuery,
        branchId: selectedBranchId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      inFlightRef.current = { key: requestKey, promise };

      const { data, count } = await promise;
      setCustomers(data);
      setTotalCount(count);
      setError(null);

      if (inFlightRef.current?.key === requestKey) {
        inFlightRef.current = null;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [repo, searchQuery, selectedBranchId, page, pageSize]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const getCustomer = useCallback((id: string) => repo.findById(id), [repo]);

  const createCustomer = useCallback(async (formData: CustomerFormData) => {
    const normalizePhone = (value?: string) => {
      if (!value) return value;
      const digitsOnly = value.replace(/\D/g, '');
      if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        return digitsOnly.slice(2);
      }
      return digitsOnly;
    };

    const resolvedBranchId =
      formData.branch_id && formData.branch_id !== 'all'
        ? formData.branch_id
        : selectedBranchId !== 'all'
          ? selectedBranchId
          : undefined;

    const dataWithBranchAndNormalizedPhone: CustomerFormData = {
      ...formData,
      phone: normalizePhone(formData.phone) || '',
      alt_phone: normalizePhone(formData.alt_phone),
      ...(resolvedBranchId ? { branch_id: resolvedBranchId } : {}),
    };

    const data = await repo.create(dataWithBranchAndNormalizedPhone);
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
