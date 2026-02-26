import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { apiError, apiSuccess } from '@/core/api';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const from = searchParams.get('from') || null;
    const to = searchParams.get('to') || null;

    const { data, error } = await supabase.rpc('get_daybook_summary', {
      p_from: from,
      p_to: to,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

    return apiSuccess({
      invoiceSales: Number(row?.invoice_sales || 0),
      collected: Number(row?.collected || 0),
      dues: Number(row?.dues || 0),
      serviceRevenue: Number(row?.service_revenue || 0),
      totalRevenue: Number(row?.total_revenue || 0),
      expensesTotal: Number(row?.expenses_total || 0),
      totalInvoices: Number(row?.total_invoices || 0),
      totalSalesDone: Number(row?.total_sales_done || 0),
      totalServices: Number(row?.total_services || 0),
      totalExpenses: Number(row?.total_expenses || 0),
    });
  } catch (error) {
    return apiError(error);
  }
}
