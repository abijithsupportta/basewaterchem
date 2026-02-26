import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Customer, CustomerFormData } from '@/types';

// Reusable select shapes
const CUSTOMER_LIST_SELECT = `
  id,
  customer_code,
  full_name,
  phone,
  alt_phone,
  email,
  address_line1,
  address_line2,
  city,
  district,
  state,
  pincode,
  location_landmark,
  notes,
  gst_number,
  is_active,
  created_by,
  branch_id,
  created_at,
  updated_at,
  branch:branches (id, branch_name, branch_code)
`;
const CUSTOMER_DETAIL_SELECT = `
  *,
  branch:branches (id, branch_name, branch_code),
  customer_products (
    *,
    product:products (*)
  )
`;

export class CustomerRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(options?: {
    search?: string;
    isActive?: boolean;
    branchId?: string;
    page?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = this.db
      .from('customers')
      .select(CUSTOMER_LIST_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options?.branchId && options.branchId !== 'all') {
      query = query.eq('branch_id', options.branchId);
    }

    if (options?.search) {
      query = query.or(
        `full_name.ilike.%${options.search}%,phone.ilike.%${options.search}%,customer_code.ilike.%${options.search}%`
      );
    }

    if (options?.offset !== undefined && options?.limit !== undefined) {
      query = query.range(options.offset, options.offset + options.limit - 1);
    }

    const { data, error, count } = await query;
    if (error) throw new DatabaseError(error.message);
        return { data: (data || []) as unknown as Customer[], count: count || 0 };
  }

  async findById(id: string): Promise<Customer> {
    const { data, error } = await this.db
      .from('customers')
      .select(CUSTOMER_DETAIL_SELECT)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('Customer', id);
        return data as unknown as Customer;
  }

  async create(formData: CustomerFormData): Promise<Customer> {
    const { data, error } = await this.db
      .from('customers')
      .insert(formData)
      .select(CUSTOMER_LIST_SELECT)
      .single();

    if (error) throw new DatabaseError(error.message);
        return data as unknown as Customer;
  }

  async update(id: string, formData: Partial<CustomerFormData>): Promise<Customer> {
    const { data, error } = await this.db
      .from('customers')
      .update(formData)
      .eq('id', id)
      .select(CUSTOMER_LIST_SELECT)
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('Customer', id);
        return data as unknown as Customer;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.db
      .from('customers')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }
}
