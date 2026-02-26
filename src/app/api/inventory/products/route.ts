import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const productSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  sku: z.string().optional(),
  unit_price: z.number().min(0, 'Price must be positive'),
  stock_quantity: z.number().int().min(0, 'Stock quantity must be non-negative'),
  min_stock_level: z.number().int().min(0).optional(),
  unit_of_measure: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const activeOnly = searchParams.get('active_only') === 'true';
    const inStockOnly = searchParams.get('in_stock_only') === 'true';

    let query = supabase
      .from('inventory_products')
      .select(`
        *,
        category:inventory_categories(id, name)
      `)
      .order('name', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (inStockOnly) {
      query = query.gt('stock_quantity', 0);
    }

    const { data: products, error } = await query;

    if (error) throw error;

    return NextResponse.json(products);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const body = await request.json();

    const validatedData = productSchema.parse(body);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Get staff ID from auth user ID
    let staffId: string | null = null;
    if (user) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      staffId = staff?.id ?? null;
    }

    // Handle empty SKU - convert to null to avoid unique constraint violation
    const productData = {
      ...validatedData,
      sku: validatedData.sku?.trim() || null,
      created_by: staffId,
    };

    const { data: product, error } = await supabase
      .from('inventory_products')
      .insert(productData)
      .select(`
        *,
        category:inventory_categories(id, name)
      `)
      .single();

    if (error) throw error;

    // Log initial stock if quantity > 0
    if (validatedData.stock_quantity > 0) {
      await supabase.rpc('log_stock_transaction', {
        p_product_id: product.id,
        p_transaction_type: 'purchase',
        p_quantity: validatedData.stock_quantity,
        p_reference_type: 'manual',
        p_notes: 'Initial stock',
        p_created_by: staffId,
      });
    }

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
