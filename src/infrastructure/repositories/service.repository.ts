import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Service, ServiceWithDetails, ServiceFormData, ServiceCompleteData } from '@/types';

const SERVICE_LIST_SELECT = `
  *,
  customer:customers (id, full_name, phone, customer_code, address_line1, city),
  branch:branches (id, branch_name, branch_code),
  amc_contract:amc_contracts (id, contract_number, status)
`;

const SERVICE_DETAIL_SELECT = `
  *,
  customer:customers (*),
  branch:branches (id, branch_name, branch_code),
  amc_contract:amc_contracts (*)
`;

export class ServiceRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(filters?: {
    status?: string;
    type?: string;
    branchId?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    freeOnly?: boolean;
    page?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = this.db
      .from('services')
      .select(SERVICE_LIST_SELECT, { count: 'exact' })
      .order('scheduled_date', { ascending: false });

    if (filters?.status === 'overdue') {
      const todayStr = new Date().toISOString().split('T')[0];
      query = query.in('status', ['scheduled', 'assigned']).lt('scheduled_date', todayStr);
    } else if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.type) query = query.eq('service_type', filters.type);
    if (filters?.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
    if (filters?.dateFrom) query = query.gte('scheduled_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('scheduled_date', filters.dateTo);
    if (filters?.freeOnly) {
      const todayStr = new Date().toISOString().split('T')[0];
      query = query
        .not('free_service_valid_until', 'is', null)
        .gte('free_service_valid_until', todayStr);
    }
    if (filters?.search) {
      const q = filters.search.replace(/%/g, '\\%');
      query = query.or(
        `service_number.ilike.%${q}%,customer.full_name.ilike.%${q}%,customer.customer_code.ilike.%${q}%,customer.phone.ilike.%${q}%`
      );
    }
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
        amc_contract:amc_contracts (id, contract_number)
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

  async delete(id: string): Promise<void> {
    // Note: Deletion of scheduled AMC services triggers automatic rescheduling via DB trigger
    // (see migration 030_amc_auto_reschedule_on_delete.sql)
    // If the deleted service was a scheduled AMC service, a new service will be auto-created
    // with the next interval date.
    const { error } = await this.db
      .from('services')
      .delete()
      .eq('id', id);

    if (error) throw new DatabaseError(error.message);
  }
}
