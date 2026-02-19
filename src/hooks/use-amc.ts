'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AmcContract, AmcFormData, AmcContractWithDetails } from '@/types';

export function useAmc(filters?: { status?: string; customerId?: string }) {
  const [contracts, setContracts] = useState<AmcContractWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('amc_contracts')
        .select(`
          *,
          customer:customers (id, full_name, phone, customer_code),
          customer_product:customer_products (
            id, serial_number,
            product:products (id, name, brand, model)
          )
        `)
        .order('end_date', { ascending: true });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.customerId) query = query.eq('customer_id', filters.customerId);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setContracts(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, filters?.status, filters?.customerId]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const getContract = async (id: string) => {
    const { data, error } = await supabase
      .from('amc_contracts')
      .select(`
        *,
        customer:customers (*),
        customer_product:customer_products (*, product:products (*))
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  };

  const createContract = async (formData: AmcFormData) => {
    const { data, error } = await supabase
      .from('amc_contracts')
      .insert(formData)
      .select()
      .single();
    if (error) throw error;
    await fetchContracts();
    return data;
  };

  const updateContract = async (id: string, formData: Partial<AmcContract>) => {
    const { data, error } = await supabase
      .from('amc_contracts')
      .update(formData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchContracts();
    return data;
  };

  const renewContract = async (id: string, newEndDate: string, amount: number) => {
    const { data, error } = await supabase
      .from('amc_contracts')
      .update({
        end_date: newEndDate,
        amount,
        status: 'active',
        services_completed: 0,
        is_paid: false,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchContracts();
    return data;
  };

  return {
    contracts,
    loading,
    error,
    fetchContracts,
    getContract,
    createContract,
    updateContract,
    renewContract,
  };
}
