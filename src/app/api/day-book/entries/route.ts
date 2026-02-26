import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { apiError, apiSuccess, parsePagination } from '@/core/api';

const ALL_TIME_CAP_DAYS = 180;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const { page, limit, offset } = parsePagination(searchParams);
    const from = searchParams.get('from') || null;
    const to = searchParams.get('to') || null;

    const { data, error } = await supabase.rpc('get_daybook_entries', {
      p_from: from,
      p_to: to,
      p_offset: offset,
      p_limit: limit,
      p_cap_days: ALL_TIME_CAP_DAYS,
    });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
    const cappedFrom = rows.length > 0 ? rows[0].capped_from || null : null;

    return apiSuccess({
      entries: rows.map((row) => ({
        entry_key: row.entry_key,
        entry_date: row.entry_date,
        entry_type: row.entry_type,
        reference: row.reference,
        description: row.description,
        amount: Number(row.amount || 0),
        dues: Number(row.dues || 0),
        status: row.status,
        source_id: row.source_id,
        expense_date: row.expense_date,
        expense_title: row.expense_title,
        expense_category: row.expense_category,
        expense_amount: row.expense_amount !== null ? Number(row.expense_amount) : null,
        expense_payment_method: row.expense_payment_method,
        expense_reference_no: row.expense_reference_no,
        expense_description: row.expense_description,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      cappedFrom,
      capDays: ALL_TIME_CAP_DAYS,
    });
  } catch (error) {
    return apiError(error);
  }
}
