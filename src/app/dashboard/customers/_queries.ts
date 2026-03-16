import { createServerSupabaseClient } from '@/lib/supabase/server';

const PAGE_SIZE = 50;

export async function getCustomers({
  q,
  page,
  pageSize = PAGE_SIZE,
}: {
  q: string;
  page: number;
  pageSize?: number;
}) {
  const supabase = await createServerSupabaseClient();
  const clampedSize = [20, 50, 100].includes(pageSize) ? pageSize : PAGE_SIZE;
  const from = (page - 1) * clampedSize;

  let query = supabase
    .from('customers')
    .select('*, branch:branches(id, branch_name, branch_code)', { count: 'exact' })
    .range(from, from + clampedSize - 1)
    .order('created_at', { ascending: false });

  if (q.trim()) {
    const escaped = q.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.or(
      `full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,customer_code.ilike.%${escaped}%`
    );
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    customers: data ?? [],
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / clampedSize),
  };
}
