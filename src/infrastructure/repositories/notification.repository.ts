import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError } from '@/core/errors';
import type { DashboardStats } from '@/types';

export class DashboardRepository {
  constructor(private readonly db: SupabaseClient) {}

  async getStats(): Promise<DashboardStats> {
    const { data, error } = await this.db
      .from('dashboard_stats_view')
      .select('*')
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as DashboardStats;
  }
}
