'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useDashboardSessionOptional } from '@/providers/dashboard-session-provider';

const STORAGE_KEY = 'selected-branch-id';
const EVENT_NAME = 'branch-selection-changed';

export type BranchSelectionValue = 'all' | string;

export function useBranchSelection() {
  const [selectedBranchId, setSelectedBranchIdState] = useState<BranchSelectionValue>('all');
  const dashboardSession = useDashboardSessionOptional();

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!dashboardSession || dashboardSession.loading) return;

    const role = dashboardSession.role;
    const userBranchId = dashboardSession.userBranch?.id || null;
    const allowedBranchIds = new Set(dashboardSession.branches.map((branch) => branch.id));

    const isPrivileged = role === 'superadmin' || role === 'manager';

    const isValidSelection =
      selectedBranchId === 'all'
        ? isPrivileged
        : allowedBranchIds.has(selectedBranchId);

    if (isValidSelection) return;

    const fallbackValue: BranchSelectionValue = isPrivileged
      ? 'all'
      : (userBranchId ?? 'all');

    setSelectedBranchIdState(fallbackValue);
    window.localStorage.setItem(STORAGE_KEY, fallbackValue);
    window.dispatchEvent(new Event(EVENT_NAME));
  }, [dashboardSession, selectedBranchId]);

  return { selectedBranchId, setSelectedBranchId, isAllBranches };
}

export interface BranchOption {
  value: string;
  label: string;
}

export function useBranchOptions(enabled: boolean) {
  const dashboardSession = useDashboardSessionOptional();

  const [options, setOptions] = useState<BranchOption[]>([{ value: 'all', label: 'All Branches' }]);
  const [loading, setLoading] = useState(false);

  const fetchBranches = useCallback(async () => {
    if (!enabled) {
      setOptions([{ value: 'all', label: 'All Branches' }]);
      setLoading(false);
      return;
    }

    if (dashboardSession) {
      const branchOptions = dashboardSession.branches.map((branch) => ({
        value: branch.id,
        label: `${branch.branch_name} (${branch.branch_code})`,
      }));

      setOptions([{ value: 'all', label: 'All Branches' }, ...branchOptions]);
      setLoading(dashboardSession.loading);
      return;
    }

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
  }, [enabled, dashboardSession]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const refetch = useCallback(async () => {
    if (dashboardSession && enabled) {
      await dashboardSession.refresh();
      return;
    }
    await fetchBranches();
  }, [dashboardSession, enabled, fetchBranches]);

  return { options, loading, refetch };
}
