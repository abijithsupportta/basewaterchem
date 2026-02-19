import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Service, ServiceWithDetails, ServiceFormData, ServiceCompleteData } from '@/types';

const SERVICE_LIST_SELECT = `
  *,
  customer:customers (id, full_name, phone, customer_code, address_line1, city),
  customer_product:customer_products (
    id, serial_number,
    product:products (id, name, brand, model)
  ),
  technician:staff!services_assigned_technician_id_fkey (id, full_name, phone)
`;

const SERVICE_DETAIL_SELECT = `
  *,
  customer:customers (*),
  customer_product:customer_products (*, product:products (*)),
  technician:staff!services_assigned_technician_id_fkey (*),
  amc_contract:amc_contracts (*),
  complaint:complaints (*)
`;

export class ServiceRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(filters?: {
    status?: string;
    type?: string;
    technicianId?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = this.db
      .from('services')
      .select(SERVICE_LIST_SELECT, { count: 'exact' })
      .order('scheduled_date', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.type) query = query.eq('service_type', filters.type);
    if (filters?.technicianId) query = query.eq('assigned_technician_id', filters.technicianId);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
    if (filters?.dateFrom) query = query.gte('scheduled_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('scheduled_date', filters.dateTo);
    if (filters?.offset !== undefined && filters?.limit !== undefined) {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
    }

    const { data, error, count } = await query;
    if (error) throw new DatabaseError(error.message);
    return { data: (data || []) as ServiceWithDetails[], count: count || 0 };
  }

  async findById(id: string) {
    const { data, error } = await this.db
      .from('services')
      .select(SERVICE_DETAIL_SELECT)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('Service', id);
    return data;
  }

  async findUpcoming(limit: number = 10) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await this.db
      .from('services')
      .select(SERVICE_LIST_SELECT)
      .in('status', ['scheduled', 'assigned'])
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(limit);

    if (error) throw new DatabaseError(error.message);
    return (data || []) as ServiceWithDetails[];
  }

  async findOverdue(limit: number = 10) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await this.db
      .from('services')
      .select(`
        *,
        customer:customers (id, full_name, phone, customer_code, city),
        customer_product:customer_products (
          id,
          product:products (name, brand)
        )
      `)
      .in('status', ['scheduled', 'assigned', 'rescheduled'])
      .lt('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(limit);

    if (error) throw new DatabaseError(error.message);
    return (data || []) as ServiceWithDetails[];
  }

  async create(formData: ServiceFormData): Promise<Service> {
    const { data, error } = await this.db
      .from('services')
      .insert(formData)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as Service;
  }

  async update(id: string, formData: Partial<Service>): Promise<Service> {
    const { data, error } = await this.db
      .from('services')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('Service', id);
    return data as Service;
  }
}
