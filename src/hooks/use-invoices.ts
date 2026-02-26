'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { InvoiceRepository } from '@/infrastructure/repositories';
import { InvoiceCalculator } from '@/core/services';
import type { InvoiceFormData, InvoiceWithDetails } from '@/types';
import { useBranchSelection } from '@/hooks/use-branch-selection';
import { readStaleCache, writeStaleCache } from '@/lib/stale-cache';

const INVOICES_CACHE_TTL_MS = 120000;

type InvoicesCachePayload = {
  invoices: InvoiceWithDetails[];
  totalCount: number;
};

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
  const inFlightRef = useRef<{
    key: string;
    promise: Promise<{ data: InvoiceWithDetails[]; count: number }>;
  } | null>(null);
  const cacheKey = useMemo(
    () =>
      `dashboard:invoices:list:v1:${JSON.stringify({
        selectedBranchId,
        status: filters?.status ?? null,
        customerId: filters?.customerId ?? null,
        search: filters?.search ?? null,
        dateFrom: filters?.dateFrom ?? null,
        dateTo: filters?.dateTo ?? null,
        page: filters?.page ?? 1,
        pageSize: filters?.pageSize ?? 20,
      })}`,
    [
      selectedBranchId,
      filters?.status,
      filters?.customerId,
      filters?.search,
      filters?.dateFrom,
      filters?.dateTo,
      filters?.page,
      filters?.pageSize,
    ]
  );

  const fetchInvoices = useCallback(async () => {
    try {
      const cached = readStaleCache<InvoicesCachePayload>(cacheKey, INVOICES_CACHE_TTL_MS);

      if (cached) {
        setInvoices(cached.invoices);
        setTotalCount(cached.totalCount);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const pageSize = filters?.pageSize ?? 20;
      const page = filters?.page ?? 1;
      const offset = (page - 1) * pageSize;
      const status = filters?.status;
      const customerId = filters?.customerId;
      const search = filters?.search;
      const dateFrom = filters?.dateFrom;
      const dateTo = filters?.dateTo;

      const requestKey = JSON.stringify({
        selectedBranchId,
        status: status ?? null,
        customerId: customerId ?? null,
        search: search ?? null,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        page,
        pageSize,
      });

      if (inFlightRef.current?.key === requestKey) {
        const pending = await inFlightRef.current.promise;
        setInvoices(pending.data);
        setTotalCount(pending.count);
        setError(null);
        return;
      }

      const promise = repo.findAll({
        status,
        customerId,
        search,
        dateFrom,
        dateTo,
        branchId: selectedBranchId,
        limit: pageSize,
        offset,
      });

      inFlightRef.current = { key: requestKey, promise };

      const { data, count } = await promise;
      setInvoices(data);
      setTotalCount(count);
      writeStaleCache<InvoicesCachePayload>(cacheKey, { invoices: data, totalCount: count });
      setError(null);

      if (inFlightRef.current?.key === requestKey) {
        inFlightRef.current = null;
      }
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
    cacheKey,
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
