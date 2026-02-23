'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'selected-branch-id';
const EVENT_NAME = 'branch-selection-changed';

export type BranchSelectionValue = 'all' | string;

export function useBranchSelection() {
  const [selectedBranchId, setSelectedBranchIdState] = useState<BranchSelectionValue>('all');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedBranchIdState(stored as BranchSelectionValue);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromStorage = () => {
      const stored = window.localStorage.getItem(STORAGE_KEY) || 'all';
      setSelectedBranchIdState(stored as BranchSelectionValue);
    };

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener(EVENT_NAME, syncFromStorage as EventListener);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener(EVENT_NAME, syncFromStorage as EventListener);
    };
  }, []);

  const setSelectedBranchId = useCallback((value: BranchSelectionValue) => {
    setSelectedBranchIdState(value);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new Event(EVENT_NAME));
  }, []);

  const isAllBranches = useMemo(() => selectedBranchId === 'all', [selectedBranchId]);

  return { selectedBranchId, setSelectedBranchId, isAllBranches };
}

export interface BranchOption {
  value: string;
  label: string;
}

export function useBranchOptions(enabled: boolean) {
  const [options, setOptions] = useState<BranchOption[]>([{ value: 'all', label: 'All Branches' }]);
  const [loading, setLoading] = useState(false);

  const fetchBranches = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('branches')
        .select('id, branch_name, branch_code')
        .eq('is_active', true)
        .order('branch_name');

      if (error) throw error;

      const branchOptions = (data || []).map((branch) => ({
        value: branch.id,
        label: `${branch.branch_name} (${branch.branch_code})`,
      }));

      setOptions([{ value: 'all', label: 'All Branches' }, ...branchOptions]);
    } catch {
      setOptions([{ value: 'all', label: 'All Branches' }]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  return { options, loading, refetch: fetchBranches };
}
