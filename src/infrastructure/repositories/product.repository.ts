import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/core/errors';
import type { Product, ProductFormData, CustomerProduct, CustomerProductFormData } from '@/types';

export class ProductRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(options?: { category?: string; search?: string; isActive?: boolean }) {
    let query = this.db
      .from('products')
      .select('*', { count: 'exact' })
      .order('name');

    if (options?.isActive !== undefined) query = query.eq('is_active', options.isActive);
    if (options?.category) query = query.eq('category', options.category);
    if (options?.search) query = query.ilike('name', `%${options.search}%`);

    const { data, error, count } = await query;
    if (error) throw new DatabaseError(error.message);
    return { data: (data || []) as Product[], count: count || 0 };
  }

  async findById(id: string): Promise<Product> {
    const { data, error } = await this.db
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('Product', id);
    return data as Product;
  }

  async create(formData: ProductFormData): Promise<Product> {
    const { data, error } = await this.db.from('products').insert(formData).select().single();
    if (error) throw new DatabaseError(error.message);
    return data as Product;
  }

  async update(id: string, formData: Partial<ProductFormData>): Promise<Product> {
    const { data, error } = await this.db.from('products').update(formData).eq('id', id).select().single();
    if (error) throw new DatabaseError(error.message);
    if (!data) throw new NotFoundError('Product', id);
    return data as Product;
  }
}

export class CustomerProductRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByCustomer(customerId: string) {
    const { data, error } = await this.db
      .from('customer_products')
      .select(`*, product:products (*)`)
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('installation_date', { ascending: false });

    if (error) throw new DatabaseError(error.message);
    return (data || []) as CustomerProduct[];
  }

  async create(formData: CustomerProductFormData): Promise<CustomerProduct> {
    const { data, error } = await this.db.from('customer_products').insert(formData).select().single();
    if (error) throw new DatabaseError(error.message);
    return data as CustomerProduct;
  }
}
