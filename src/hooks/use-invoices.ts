'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { InvoiceRepository } from '@/infrastructure/repositories';
import { InvoiceCalculator } from '@/core/services';
import type { Invoice, InvoiceFormData, InvoiceWithDetails } from '@/types';

export function useInvoices(filters?: { status?: string; customerId?: string }) {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const repo = useMemo(() => new InvoiceRepository(supabase), [supabase]);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await repo.findAll(filters);
      setInvoices(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  }, [repo, filters?.status, filters?.customerId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const getInvoice = useCallback((id: string) => repo.findById(id), [repo]);

  const createInvoice = useCallback(async (formData: InvoiceFormData) => {
    const { items, ...invoiceData } = formData;
    const calculated = InvoiceCalculator.calculate(
      items, invoiceData.tax_percent, invoiceData.discount_amount
    );

    const invoice = await repo.create({
      ...invoiceData,
      ...calculated,
      balance_due: calculated.total_amount,
      amount_paid: 0,
      status: 'draft',
      invoice_date: invoiceData.invoice_date || new Date().toISOString().split('T')[0],
      tax_percent: invoiceData.tax_percent || 18,
      discount_amount: invoiceData.discount_amount || 0,
    } as Parameters<typeof repo.create>[0]);

    const itemsToInsert = items.map((item, index) => ({
      invoice_id: invoice.id,
      ...item,
      total_price: InvoiceCalculator.itemTotal(item.quantity, item.unit_price),
      sort_order: index,
    }));

    await repo.createItems(itemsToInsert);
    await fetchInvoices();
    return invoice;
  }, [repo, fetchInvoices]);

  const recordPayment = useCallback(async (id: string, amount: number, method: string, reference?: string) => {
    const invoice = await repo.findById(id);
    const { amountPaid, balanceDue, status } = InvoiceCalculator.paymentStatus(
      invoice.total_amount, invoice.amount_paid || 0, amount
    );

    const data = await repo.update(id, {
      amount_paid: amountPaid,
      balance_due: balanceDue,
      status,
      payment_method: method,
      payment_reference: reference || null,
    });
    await fetchInvoices();
    return data;
  }, [repo, fetchInvoices]);

  return { invoices, loading, error, fetchInvoices, getInvoice, createInvoice, recordPayment };
}
