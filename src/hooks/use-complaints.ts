'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Complaint, ComplaintFormData, ComplaintWithDetails } from '@/types';

export function useComplaints(filters?: { status?: string; priority?: string; customerId?: string }) {
  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('complaints')
        .select(`
          *,
          customer:customers (id, full_name, phone, customer_code),
          customer_product:customer_products (
            id,
            product:products (name, brand, model)
          ),
          assigned_staff:staff!complaints_assigned_to_fkey (id, full_name, phone)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.priority) query = query.eq('priority', filters.priority);
      if (filters?.customerId) query = query.eq('customer_id', filters.customerId);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setComplaints(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, filters?.status, filters?.priority, filters?.customerId]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const getComplaint = async (id: string) => {
    const { data, error } = await supabase
      .from('complaints')
      .select(`
        *,
        customer:customers (*),
        customer_product:customer_products (*, product:products (*)),
        assigned_staff:staff!complaints_assigned_to_fkey (*)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  };

  const createComplaint = async (formData: ComplaintFormData) => {
    const { data, error } = await supabase
      .from('complaints')
      .insert(formData)
      .select()
      .single();
    if (error) throw error;
    await fetchComplaints();
    return data;
  };

  const updateComplaint = async (id: string, formData: Partial<Complaint>) => {
    const { data, error } = await supabase
      .from('complaints')
      .update(formData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchComplaints();
    return data;
  };

  const resolveComplaint = async (id: string, resolutionNotes: string) => {
    const { data, error } = await supabase
      .from('complaints')
      .update({
        status: 'resolved',
        resolved_date: new Date().toISOString(),
        resolution_notes: resolutionNotes,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchComplaints();
    return data;
  };

  return {
    complaints,
    loading,
    error,
    fetchComplaints,
    getComplaint,
    createComplaint,
    updateComplaint,
    resolveComplaint,
  };
}
