import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const productUpdateSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'Product name is required').optional(),
  description: z.string().optional(),
  sku: z.string().optional(),
  unit_price: z.number().min(0, 'Price must be positive').optional(),
  min_stock_level: z.number().int().min(0).optional(),
  unit_of_measure: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
});

const stockAdjustmentSchema = z.object({
  adjustment: z.number().int(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: product, error } = await supabase
      .from('inventory_products')
      .select(`
        *,
        category:inventory_categories(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const body = await request.json();

    const validatedData = productUpdateSchema.parse(body);

    // Handle empty SKU - convert to null to avoid unique constraint violation
    const updateData = {
      ...validatedData,
      ...(validatedData.sku !== undefined && {
        sku: validatedData.sku?.trim() || null,
      }),
    };

    const { data: product, error } = await supabase
      .from('inventory_products')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        category:inventory_categories(id, name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error updating product:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('inventory_products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete product' },
      { status: 500 }
    );
  }
}

// Adjust stock endpoint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const body = await request.json();

    const { adjustment, notes } = stockAdjustmentSchema.parse(body);

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

    // Use the log_stock_transaction function
    const { error } = await supabase.rpc('log_stock_transaction', {
      p_product_id: id,
      p_transaction_type: 'adjustment',
      p_quantity: adjustment,
      p_reference_type: 'manual',
      p_notes: notes || 'Manual stock adjustment',
      p_created_by: staffId,
    });

    if (error) throw error;

    // Fetch updated product
    const { data: product } = await supabase
      .from('inventory_products')
      .select(`
        *,
        category:inventory_categories(id, name)
      `)
      .eq('id', id)
      .single();

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error adjusting stock:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to adjust stock' },
      { status: 500 }
    );
  }
}
