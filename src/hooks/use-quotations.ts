'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Quotation, QuotationFormData, QuotationWithDetails } from '@/types';

export function useQuotations(filters?: { status?: string; customerId?: string }) {
  const [quotations, setQuotations] = useState<QuotationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('quotations')
        .select(`
          *,
          customer:customers (id, full_name, phone, email, address_line1, city, customer_code),
          items:quotation_items (*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.customerId) query = query.eq('customer_id', filters.customerId);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setQuotations(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, filters?.status, filters?.customerId]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const getQuotation = async (id: string) => {
    const { data, error } = await supabase
      .from('quotations')
      .select(`
        *,
        customer:customers (*),
        items:quotation_items (*)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  };

  const createQuotation = async (formData: QuotationFormData) => {
    const { items, ...quotationData } = formData;
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxAmount = subtotal * ((quotationData.tax_percent || 18) / 100);
    const totalAmount = subtotal + taxAmount - (quotationData.discount_amount || 0);

    const { data: quotation, error: qError } = await supabase
      .from('quotations')
      .insert({
        ...quotationData,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      })
      .select()
      .single();
    if (qError) throw qError;

    // Insert items
    const itemsToInsert = items.map((item, index) => ({
      quotation_id: quotation.id,
      ...item,
      total_price: item.quantity * item.unit_price,
      sort_order: index,
    }));

    const { error: iError } = await supabase
      .from('quotation_items')
      .insert(itemsToInsert);
    if (iError) throw iError;

    await fetchQuotations();
    return quotation;
  };

  const updateQuotationStatus = async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('quotations')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchQuotations();
    return data;
  };

  return {
    quotations,
    loading,
    error,
    fetchQuotations,
    getQuotation,
    createQuotation,
    updateQuotationStatus,
  };
}
