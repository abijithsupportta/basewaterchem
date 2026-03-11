import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Invoice, InvoiceSortBy, InvoiceWithDetails } from '@/types';

const INVOICE_LIST_SELECT = `
  id,
  invoice_number,
  customer_id,
  branch_id,
  invoice_date,
  status,
  amc_enabled,
  total_amount,
  amount_paid,
  balance_due,
  created_at,
  customer:customers (id, full_name, phone, email, address_line1, city, customer_code),
  branch:branches (id, branch_name, branch_code)
`;

export class InvoiceRepository {
  constructor(private readonly db: SupabaseClient) {}

  private applySort(
    query: any,
    sortBy: InvoiceSortBy
  ) {
    switch (sortBy) {
      case 'invoice_date_asc':
        return query
          .order('invoice_date', { ascending: true })
          .order('created_at', { ascending: true });
      case 'created_at_desc':
        return query.order('created_at', { ascending: false });
      case 'created_at_asc':
        return query.order('created_at', { ascending: true });
      case 'total_amount_desc':
        return query
          .order('total_amount', { ascending: false })
          .order('invoice_date', { ascending: false })
          .order('created_at', { ascending: false });
      case 'total_amount_asc':
        return query
          .order('total_amount', { ascending: true })
          .order('invoice_date', { ascending: false })
          .order('created_at', { ascending: false });
      case 'balance_due_desc':
        return query
          .order('balance_due', { ascending: false })
          .order('invoice_date', { ascending: false })
          .order('created_at', { ascending: false });
      case 'balance_due_asc':
        return query
          .order('balance_due', { ascending: true })
          .order('invoice_date', { ascending: false })
          .order('created_at', { ascending: false });
      case 'invoice_date_desc':
      default:
        return query
          .order('invoice_date', { ascending: false })
          .order('created_at', { ascending: false });
    }
  }

  async findAll(filters?: {
    status?: string;
    customerId?: string;
    branchId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: InvoiceSortBy;
    limit?: number;
    offset?: number;
  }) {
    let query = this.db
      .from('invoices')
      .select(INVOICE_LIST_SELECT, { count: 'exact' });

    query = this.applySort(query, filters?.sortBy ?? 'invoice_date_desc');

    if (filters?.status === 'pending_due') {
      query = query
        .gt('balance_due', 0)
        .neq('status', 'cancelled');
    } else if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
    if (filters?.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
    if (filters?.dateFrom) query = query.gte('invoice_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('invoice_date', filters.dateTo);
    if (filters?.search) {
      const q = filters.search.replace(/%/g, '\\%');
      query = query.or(
        `invoice_number.ilike.%${q}%,customer.full_name.ilike.%${q}%,customer.customer_code.ilike.%${q}%`
      );
    }
    
    if (filters?.limit && filters?.offset !== undefined) {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
    }

    const { data, error, count } = await query;
    if (error) throw new DatabaseError(error.message);
    return { data: (data || []) as unknown as InvoiceWithDetails[], count: count || 0 };
  }

  async findById(id: string) {
    const { data, error } = await this.db
      .from('invoices')
      .select(`*, customer:customers (*), branch:branches (id, branch_name, branch_code), items:invoice_items (*)`)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('Invoice', id);
    return data as InvoiceWithDetails;
  }

  async create(invoiceData: Partial<Invoice> & { customer_id: string }): Promise<Invoice> {
    const { data, error } = await this.db
      .from('invoices')
      .insert(invoiceData)
      .select(`*, customer:customers (id, full_name, phone, email, address_line1, city, customer_code), branch:branches (id, branch_name, branch_code)`)
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as Invoice;
  }

  async createItems(items: Array<Record<string, unknown>>): Promise<void> {
    const { error } = await this.db
      .from('invoice_items')
      .insert(items);

    if (error) throw new DatabaseError(error.message);
  }

  async update(id: string, data: Partial<Invoice>): Promise<Invoice> {
    const { data: updated, error } = await this.db
      .from('invoices')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!updated) throw new NotFoundError('Invoice', id);
    return updated as Invoice;
  }

  async delete(id: string): Promise<void> {
    // Delete invoice items first (child rows)
    const { error: itemsError } = await this.db
      .from('invoice_items')
      .delete()
      .eq('invoice_id', id);
    if (itemsError) throw new DatabaseError(itemsError.message);

    // Delete the invoice
    const { error } = await this.db
      .from('invoices')
      .delete()
      .eq('id', id);
    if (error) throw new DatabaseError(error.message);
  }
}
