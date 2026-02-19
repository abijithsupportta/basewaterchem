import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError } from '@/core/errors';
import type { Notification, DashboardStats } from '@/types';

export class NotificationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(limit: number = 50) {
    const { data, error } = await this.db
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new DatabaseError(error.message);
    return (data || []) as Notification[];
  }

  async markAsRead(id: string): Promise<void> {
    const { error } = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }

  async markAllAsRead(): Promise<void> {
    const { error } = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) throw new DatabaseError(error.message);
  }

  async createMany(notifications: Array<Record<string, unknown>>): Promise<void> {
    const { error } = await this.db
      .from('notifications')
      .insert(notifications);

    if (error) throw new DatabaseError(error.message);
  }
}

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
