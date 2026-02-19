import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Invoice, InvoiceFormData, InvoiceWithDetails, InvoiceItemFormData } from '@/types';

const INVOICE_LIST_SELECT = `
  *,
  customer:customers (id, full_name, phone, email, address_line1, city, customer_code),
  items:invoice_items (*)
`;

export class InvoiceRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(filters?: { status?: string; customerId?: string }) {
    let query = this.db
      .from('invoices')
      .select(INVOICE_LIST_SELECT)
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message);
    return (data || []) as InvoiceWithDetails[];
  }

  async findById(id: string) {
    const { data, error } = await this.db
      .from('invoices')
      .select(`*, customer:customers (*), items:invoice_items (*)`)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('Invoice', id);
    return data as InvoiceWithDetails;
  }

  async create(invoiceData: Partial<Invoice> & { customer_id: string }): Promise<Invoice> {
    const { data, error } = await this.db
      .from('invoices')
      .insert(invoiceData)
      .select()
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
}
