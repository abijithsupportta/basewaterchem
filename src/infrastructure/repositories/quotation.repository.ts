import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Quotation, QuotationFormData, QuotationWithDetails, QuotationItemFormData } from '@/types';

const QUOTATION_LIST_SELECT = `
  *,
  customer:customers (id, full_name, phone, email, address_line1, city, customer_code),
  items:quotation_items (*)
`;

export class QuotationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(filters?: { status?: string; customerId?: string }) {
    let query = this.db
      .from('quotations')
      .select(QUOTATION_LIST_SELECT)
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message);
    return (data || []) as QuotationWithDetails[];
  }

  async findById(id: string) {
    const { data, error } = await this.db
      .from('quotations')
      .select(`*, customer:customers (*), items:quotation_items (*)`)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('Quotation', id);
    return data as QuotationWithDetails;
  }

  async create(quotationData: Record<string, unknown>): Promise<Quotation> {
    const { data, error } = await this.db
      .from('quotations')
      .insert(quotationData)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data as Quotation;
  }

  async createItems(items: Array<Record<string, unknown>>): Promise<void> {
    const { error } = await this.db
      .from('quotation_items')
      .insert(items);

    if (error) throw new DatabaseError(error.message);
  }

  async update(id: string, data: Partial<Quotation>): Promise<Quotation> {
    const { data: updated, error } = await this.db
      .from('quotations')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!updated) throw new NotFoundError('Quotation', id);
    return updated as Quotation;
  }
}
