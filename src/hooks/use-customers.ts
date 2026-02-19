'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Customer, CustomerFormData } from '@/types';

export function useCustomers(searchQuery?: string) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,customer_code.ilike.%${searchQuery}%`);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setCustomers(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, searchQuery]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const getCustomer = async (id: string) => {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        customer_products (
          *,
          product:products (*)
        )
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  };

  const createCustomer = async (formData: CustomerFormData) => {
    const { data, error } = await supabase
      .from('customers')
      .insert(formData)
      .select()
      .single();
    if (error) throw error;
    await fetchCustomers();
    return data;
  };

  const updateCustomer = async (id: string, formData: Partial<CustomerFormData>) => {
    const { data, error } = await supabase
      .from('customers')
      .update(formData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchCustomers();
    return data;
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
    await fetchCustomers();
  };

  return {
    customers,
    loading,
    error,
    fetchCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  };
}
