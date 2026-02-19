import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Staff, StaffFormData } from '@/types';

export class StaffRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(options?: { role?: string; isActive?: boolean }) {
    let query = this.db
      .from('staff')
      .select('*')
      .order('full_name');

    if (options?.isActive !== undefined) query = query.eq('is_active', options.isActive);
    if (options?.role) query = query.eq('role', options.role);

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message);
    return (data || []) as Staff[];
  }

  async findById(id: string): Promise<Staff> {
    const { data, error } = await this.db.from('staff').select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundError('Staff', id);
    return data as Staff;
  }

  async findByAuthUserId(authUserId: string): Promise<Staff | null> {
    const { data, error } = await this.db
      .from('staff')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();
    if (error) return null;
    return data as Staff;
  }

  async findTechnicians(): Promise<Staff[]> {
    const { data, error } = await this.db
      .from('staff')
      .select('*')
      .eq('role', 'technician')
      .eq('is_active', true)
      .order('full_name');
    if (error) throw new DatabaseError(error.message);
    return (data || []) as Staff[];
  }

  async create(formData: StaffFormData): Promise<Staff> {
    const { data, error } = await this.db.from('staff').insert(formData).select().single();
    if (error) throw new DatabaseError(error.message);
    return data as Staff;
  }

  async update(id: string, formData: Partial<StaffFormData>): Promise<Staff> {
    const { data, error } = await this.db.from('staff').update(formData).eq('id', id).select().single();
    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('Staff', id);
    return data as Staff;
  }
}
