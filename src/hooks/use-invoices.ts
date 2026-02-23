'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { InvoiceRepository } from '@/infrastructure/repositories';
import { InvoiceCalculator } from '@/core/services';
import type { Invoice, InvoiceFormData, InvoiceWithDetails } from '@/types';
import { useBranchSelection } from '@/hooks/use-branch-selection';

export function useInvoices(filters?: {
  status?: string;
  customerId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const supabase = createClient();
  const repo = useMemo(() => new InvoiceRepository(supabase), [supabase]);
  const { selectedBranchId } = useBranchSelection();

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const pageSize = filters?.pageSize ?? 20;
      const page = filters?.page ?? 1;
      const offset = (page - 1) * pageSize;
      const { data, count } = await repo.findAll({
        ...filters,
        branchId: selectedBranchId,
        limit: pageSize,
        offset,
      });
      setInvoices(data);
      setTotalCount(count);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  }, [
    repo,
    selectedBranchId,
    filters?.status,
    filters?.customerId,
    filters?.search,
    filters?.dateFrom,
    filters?.dateTo,
    filters?.page,
    filters?.pageSize,
  ]);

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
    // Add to local state immediately with items included
    setInvoices((prev) => [{ ...invoice, items: itemsToInsert } as any, ...prev]);
    return invoice;
  }, [repo]);

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
    // Update local state immediately
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...data } : inv)));
    return data;
  }, [repo]);

  return { invoices, loading, error, totalCount, fetchInvoices, getInvoice, createInvoice, recordPayment };
}
