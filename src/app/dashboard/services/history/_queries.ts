import { createServerSupabaseClient } from '@/lib/supabase/server';

const PAGE_SIZE = 50;

export async function getCompletedServices({
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
    .from('services')
    .select('*, customer:customers(full_name, customer_code)', { count: 'exact' })
    .eq('status', 'completed')
    .range(from, from + clampedSize - 1)
    .order('completed_date', { ascending: false });

  if (q.trim()) {
    const esc = q.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
    // Search by service_number; customer name search handled separately
    query = query.ilike('service_number', `%${esc}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  // If there's a search term, also look up by customer name and merge
  if (q.trim() && data) {
    const esc = q.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
    const { data: byCustomer } = await supabase
      .from('services')
      .select('*, customer:customers!inner(full_name, customer_code)')
      .eq('status', 'completed')
      .ilike('customers.full_name', `%${esc}%`)
      .order('completed_date', { ascending: false })
      .limit(clampedSize);

    if (byCustomer && byCustomer.length > 0) {
      const merged = [...data];
      const existingIds = new Set(data.map((s) => s.id));
      for (const s of byCustomer) {
        if (!existingIds.has(s.id)) merged.push(s);
      }
      return {
        services: merged.slice(0, clampedSize),
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / clampedSize),
      };
    }
  }

  return {
    services: data ?? [],
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / clampedSize),
  };
}
