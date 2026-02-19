'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Invoice, InvoiceFormData, InvoiceWithDetails } from '@/types';

export function useInvoices(filters?: { status?: string; customerId?: string }) {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('invoices')
        .select(`
          *,
          customer:customers (id, full_name, phone, email, address_line1, city, customer_code),
          items:invoice_items (*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.customerId) query = query.eq('customer_id', filters.customerId);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setInvoices(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, filters?.status, filters?.customerId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const getInvoice = async (id: string) => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`*, customer:customers (*), items:invoice_items (*)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  };

  const createInvoice = async (formData: InvoiceFormData) => {
    const { items, ...invoiceData } = formData;

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxAmount = subtotal * ((invoiceData.tax_percent || 18) / 100);
    const totalAmount = subtotal + taxAmount - (invoiceData.discount_amount || 0);

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        ...invoiceData,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        balance_due: totalAmount,
      })
      .select()
      .single();
    if (invError) throw invError;

    const itemsToInsert = items.map((item, index) => ({
      invoice_id: invoice.id,
      ...item,
      total_price: item.quantity * item.unit_price,
      sort_order: index,
    }));

    const { error: iError } = await supabase
      .from('invoice_items')
      .insert(itemsToInsert);
    if (iError) throw iError;

    await fetchInvoices();
    return invoice;
  };

  const recordPayment = async (id: string, amount: number, method: string, reference?: string) => {
    const invoice = await getInvoice(id);
    const newAmountPaid = (invoice.amount_paid || 0) + amount;
    const newBalanceDue = invoice.total_amount - newAmountPaid;
    const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial';

    const { data, error } = await supabase
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        balance_due: Math.max(0, newBalanceDue),
        status: newStatus,
        payment_method: method,
        payment_reference: reference,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchInvoices();
    return data;
  };

  return {
    invoices,
    loading,
    error,
    fetchInvoices,
    getInvoice,
    createInvoice,
    recordPayment,
  };
}
