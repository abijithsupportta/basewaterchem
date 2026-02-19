import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { QuotationRepository } from '@/infrastructure/repositories';
import { InvoiceCalculator } from '@/core/services';
import { quotationSchema } from '@/lib/validators';
import { apiSuccess, apiError } from '@/core/api';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new QuotationRepository(supabase);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const data = await repo.findAll({ status });
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new QuotationRepository(supabase);
    const body = await request.json();
    const validated = quotationSchema.parse(body);
    const { items, ...quotationData } = validated;

    const calculated = InvoiceCalculator.calculate(
      items,
      quotationData.tax_percent ?? 0,
      quotationData.discount_amount ?? 0
    );

    const quotation = await repo.create({ ...quotationData, ...calculated });
    if (items.length > 0) {
      await repo.createItems(
        items.map((item) => ({ ...item, quotation_id: quotation.id }))
      );
    }
    return apiSuccess(quotation, 201);
  } catch (error) {
    return apiError(error);
  }
}
