'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { QuotationRepository } from '@/infrastructure/repositories';
import { InvoiceCalculator } from '@/core/services';
import type { Quotation, QuotationFormData, QuotationWithDetails } from '@/types';

export function useQuotations(filters?: { status?: string; customerId?: string }) {
  const [quotations, setQuotations] = useState<QuotationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const repo = useMemo(() => new QuotationRepository(supabase), [supabase]);

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await repo.findAll(filters);
      setQuotations(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quotations');
    } finally {
      setLoading(false);
    }
  }, [repo, filters?.status, filters?.customerId]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const getQuotation = useCallback((id: string) => repo.findById(id), [repo]);

  const createQuotation = useCallback(async (formData: QuotationFormData) => {
    const { items, ...quotationData } = formData;
    const calculated = InvoiceCalculator.calculate(
      items, quotationData.tax_percent, quotationData.discount_amount
    );

    const quotation = await repo.create({
      ...quotationData,
      ...calculated,
    });

    const itemsToInsert = items.map((item, index) => ({
      quotation_id: quotation.id,
      ...item,
      total_price: InvoiceCalculator.itemTotal(item.quantity, item.unit_price),
      sort_order: index,
    }));

    await repo.createItems(itemsToInsert);
    await fetchQuotations();
    return quotation;
  }, [repo, fetchQuotations]);

  const updateQuotationStatus = useCallback(async (id: string, status: string) => {
    const data = await repo.update(id, { status } as Partial<Quotation>);
    await fetchQuotations();
    return data;
  }, [repo, fetchQuotations]);

  return { quotations, loading, error, fetchQuotations, getQuotation, createQuotation, updateQuotationStatus };
}
