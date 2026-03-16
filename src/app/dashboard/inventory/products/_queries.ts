import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { InventoryCategory, InventoryProduct } from '@/types/inventory';

const PAGE_SIZE = 50;

export async function getProductsPage({
  q,
  categoryId,
  page,
  pageSize = PAGE_SIZE,
}: {
  q: string;
  categoryId: string;
  page: number;
  pageSize?: number;
}) {
  const supabase = await createServerSupabaseClient();
  const clampedSize = [20, 50, 100].includes(pageSize) ? pageSize : PAGE_SIZE;
  const from = (page - 1) * clampedSize;

  let query = supabase
    .from('inventory_products')
    .select('*, category:inventory_categories(id, name)', { count: 'exact' })
    .range(from, from + clampedSize - 1)
    .order('name');

  if (q.trim()) {
    const esc = q.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.or(`name.ilike.%${esc}%,sku.ilike.%${esc}%,description.ilike.%${esc}%`);
  }
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    products: (data ?? []) as InventoryProduct[],
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / clampedSize),
  };
}

export async function getProductStats() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('inventory_products')
    .select('id, stock_quantity, unit_price, is_active, min_stock_level, category_id');
  if (error) throw error;

  const products = data ?? [];
  return {
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.is_active).length,
    totalStockQuantity: products.reduce((s, p) => s + (p.stock_quantity ?? 0), 0),
    totalStockValue: products.reduce((s, p) => s + (p.stock_quantity ?? 0) * (p.unit_price ?? 0), 0),
    outOfStock: products.filter((p) => p.is_active && p.stock_quantity === 0).length,
    lowStock: products.filter(
      (p) => p.is_active && p.min_stock_level && (p.stock_quantity ?? 0) <= p.min_stock_level
    ).length,
    totalCategories: new Set(products.map((p) => p.category_id).filter(Boolean)).size,
  };
}

export async function getInventoryCategories(): Promise<InventoryCategory[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('inventory_categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as InventoryCategory[];
}
