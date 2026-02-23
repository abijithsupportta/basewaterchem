import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Expense, ExpenseFormData } from '@/types/expense';

export class ExpenseRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(filters?: {
    from?: string;
    to?: string;
    category?: string;
    branchId?: string;
    page?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = this.db
      .from('expenses')
      .select('*', { count: 'exact' })
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.from) query = query.gte('expense_date', filters.from);
    if (filters?.to) query = query.lte('expense_date', filters.to);
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
    if (filters?.offset !== undefined && filters?.limit !== undefined) {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
    }

    const { data, error, count } = await query;
    if (error) throw new DatabaseError(error.message);
    return { data: (data || []) as Expense[], count: count || 0 };
  }

  async create(payload: ExpenseFormData & { created_by_staff_id?: string | null }): Promise<Expense> {
    const { data, error } = await this.db
      .from('expenses')
      .insert(payload)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as Expense;
  }

  async update(id: string, payload: Partial<ExpenseFormData>): Promise<Expense> {
    const { data, error } = await this.db
      .from('expenses')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('Expense', id);
    return data as Expense;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('expenses').delete().eq('id', id);
    if (error) throw new DatabaseError(error.message);
  }
}
