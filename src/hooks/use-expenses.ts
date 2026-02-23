'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ExpenseRepository } from '@/infrastructure/repositories/expense.repository';
import type { Expense, ExpenseFormData } from '@/types/expense';
import { useBranchSelection } from '@/hooks/use-branch-selection';

export function useExpenses(filters?: { from?: string; to?: string; category?: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const repo = useMemo(() => new ExpenseRepository(supabase), [supabase]);
  const { selectedBranchId } = useBranchSelection();

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await repo.findAll({
        ...filters,
        branchId: selectedBranchId,
      });
      setExpenses(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  }, [repo, selectedBranchId, filters?.from, filters?.to, filters?.category]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const createExpense = useCallback(async (payload: ExpenseFormData) => {
    const created = await repo.create(payload);
    await fetchExpenses();
    return created;
  }, [repo, fetchExpenses]);

  const deleteExpense = useCallback(async (id: string) => {
    await repo.delete(id);
    await fetchExpenses();
  }, [repo, fetchExpenses]);

  return { expenses, loading, error, fetchExpenses, createExpense, deleteExpense };
}
