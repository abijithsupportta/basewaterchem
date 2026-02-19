import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Complaint, ComplaintFormData, ComplaintWithDetails } from '@/types';

const COMPLAINT_LIST_SELECT = `
  *,
  customer:customers (id, full_name, phone, customer_code),
  customer_product:customer_products (
    id,
    product:products (name, brand, model)
  ),
  assigned_staff:staff!complaints_assigned_to_fkey (id, full_name, phone)
`;

const COMPLAINT_DETAIL_SELECT = `
  *,
  customer:customers (*),
  customer_product:customer_products (*, product:products (*)),
  assigned_staff:staff!complaints_assigned_to_fkey (*)
`;

export class ComplaintRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(filters?: { status?: string; priority?: string; customerId?: string }) {
    let query = this.db
      .from('complaints')
      .select(COMPLAINT_LIST_SELECT)
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.priority) query = query.eq('priority', filters.priority);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message);
    return (data || []) as ComplaintWithDetails[];
  }

  async findRecent(limit: number = 5) {
    const { data, error } = await this.db
      .from('complaints')
      .select(`
        *,
        customer:customers (id, full_name, phone, customer_code)
      `)
      .in('status', ['open', 'acknowledged', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new DatabaseError(error.message);
    return (data || []) as ComplaintWithDetails[];
  }

  async findById(id: string) {
    const { data, error } = await this.db
      .from('complaints')
      .select(COMPLAINT_DETAIL_SELECT)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('Complaint', id);
    return data as ComplaintWithDetails;
  }

  async create(formData: ComplaintFormData): Promise<Complaint> {
    const { data, error } = await this.db
      .from('complaints')
      .insert(formData)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as Complaint;
  }

  async update(id: string, formData: Partial<Complaint>): Promise<Complaint> {
    const { data, error } = await this.db
      .from('complaints')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('Complaint', id);
    return data as Complaint;
  }
}
