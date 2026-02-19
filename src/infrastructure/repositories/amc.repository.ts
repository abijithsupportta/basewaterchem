import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { AmcContract, AmcFormData, AmcContractWithDetails } from '@/types';

const AMC_LIST_SELECT = `
  *,
  customer:customers (id, full_name, phone, customer_code),
  customer_product:customer_products (
    id, serial_number,
    product:products (id, name, brand, model)
  )
`;

const AMC_DETAIL_SELECT = `
  *,
  customer:customers (*),
  customer_product:customer_products (*, product:products (*))
`;

export class AmcRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(filters?: { status?: string; customerId?: string }) {
    let query = this.db
      .from('amc_contracts')
      .select(AMC_LIST_SELECT)
      .order('end_date', { ascending: true });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message);
    return (data || []) as AmcContractWithDetails[];
  }

  async findById(id: string) {
    const { data, error } = await this.db
      .from('amc_contracts')
      .select(AMC_DETAIL_SELECT)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('AMC Contract', id);
    return data;
  }

  async create(formData: AmcFormData): Promise<AmcContract> {
    const { data, error } = await this.db
      .from('amc_contracts')
      .insert(formData)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as AmcContract;
  }

  async update(id: string, formData: Partial<AmcContract>): Promise<AmcContract> {
    const { data, error } = await this.db
      .from('amc_contracts')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('AMC Contract', id);
    return data as AmcContract;
  }
}
