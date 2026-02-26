import type { SupabaseClient } from '@supabase/supabase-js';

export type StockLineInput = {
  productId?: string | null;
  quantity: unknown;
  label?: string;
};

export type StockLine = {
  productId: string;
  quantity: number;
  label?: string;
};

export type StockDelta = {
  productId: string;
  delta: number;
};

type StockRow = {
  id: string;
  name: string;
  stock_quantity: number;
};

export function normalizeIntegerQuantity(value: unknown): number {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

export function normalizeStockLines(items: StockLineInput[]): StockLine[] {
  const normalized: StockLine[] = [];

  for (const item of items) {
    if (!item.productId) continue;

    const quantity = normalizeIntegerQuantity(item.quantity);

    if (quantity <= 0) continue;
    if (!Number.isInteger(quantity)) {
      throw new Error(`Invalid quantity for ${item.label || 'selected stock item'}.`);
    }

    normalized.push({
      productId: item.productId,
      quantity,
      label: item.label,
    });
  }

  return normalized;
}

export function aggregateStockLinesByProduct(lines: StockLine[]): Map<string, number> {
  const grouped = new Map<string, number>();
  for (const line of lines) {
    grouped.set(line.productId, (grouped.get(line.productId) || 0) + line.quantity);
  }
  return grouped;
}

export function buildStockDeltas(previous: StockLine[], next: StockLine[]): StockDelta[] {
  const previousMap = aggregateStockLinesByProduct(previous);
  const nextMap = aggregateStockLinesByProduct(next);

  const allProductIds = new Set<string>([...previousMap.keys(), ...nextMap.keys()]);
  const deltas: StockDelta[] = [];

  for (const productId of allProductIds) {
    const delta = (nextMap.get(productId) || 0) - (previousMap.get(productId) || 0);
    if (delta !== 0) {
      deltas.push({ productId, delta });
    }
  }

  return deltas;
}

async function getStockRowsByIds(supabase: SupabaseClient, productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, StockRow>();
  }

  const { data, error } = await supabase
    .from('inventory_products')
    .select('id, name, stock_quantity')
    .in('id', productIds);

  if (error) {
    throw new Error(error.message || 'Failed to validate stock quantity.');
  }

  return new Map(
    ((data || []) as StockRow[]).map((row) => [row.id, row])
  );
}

export async function validateStockAvailabilityForLines(
  supabase: SupabaseClient,
  lines: StockLine[]
) {
  const requestedByProduct = aggregateStockLinesByProduct(lines);
  const stockRows = await getStockRowsByIds(supabase, [...requestedByProduct.keys()]);

  for (const [productId, requestedQty] of requestedByProduct.entries()) {
    const product = stockRows.get(productId);
    if (!product) {
      throw new Error('Selected stock item was not found. Please refresh and try again.');
    }

    const availableStock = Number(product.stock_quantity) || 0;
    if (requestedQty > availableStock) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${requestedQty}.`);
    }
  }
}

export async function validateStockAvailabilityForDeltas(
  supabase: SupabaseClient,
  deltas: StockDelta[]
) {
  const deductionDeltas = deltas.filter((entry) => entry.delta > 0);
  if (deductionDeltas.length === 0) return;

  const stockRows = await getStockRowsByIds(
    supabase,
    deductionDeltas.map((entry) => entry.productId)
  );

  for (const entry of deductionDeltas) {
    const product = stockRows.get(entry.productId);
    if (!product) {
      throw new Error('Selected stock item was not found. Please refresh and try again.');
    }

    const availableStock = Number(product.stock_quantity) || 0;
    if (entry.delta > availableStock) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${availableStock}, Requested additional: ${entry.delta}.`);
    }
  }
}

export async function applyStockLines(
  supabase: SupabaseClient,
  params: {
    lines: StockLine[];
    transactionType: 'sale' | 'service';
    referenceType: 'invoice' | 'service';
    referenceId: string;
    referenceLabel: string;
    createdBy: string | null;
  }
) {
  const { lines, transactionType, referenceType, referenceId, referenceLabel, createdBy } = params;
  const aggregated = aggregateStockLinesByProduct(lines);

  if (aggregated.size === 0) {
    return;
  }

  const labelByProduct = new Map<string, string>();
  for (const line of lines) {
    if (!labelByProduct.has(line.productId) && line.label) {
      labelByProduct.set(line.productId, line.label);
    }
  }

  const tasks = [...aggregated.entries()].map(async ([productId, quantity]) => {
    const { error } = await supabase.rpc('log_stock_transaction', {
      p_product_id: productId,
      p_transaction_type: transactionType,
      p_quantity: -quantity,
      p_reference_type: referenceType,
      p_reference_id: referenceId,
      p_notes: `${referenceLabel}${labelByProduct.get(productId) ? ` (${labelByProduct.get(productId)})` : ''}`,
      p_created_by: createdBy,
    });

    if (error) {
      throw new Error(
        error.message || `Failed to deduct stock for ${labelByProduct.get(productId) || 'stock item'}.`
      );
    }
  });

  await Promise.all(tasks);
}

export async function applyStockDeltas(
  supabase: SupabaseClient,
  params: {
    deltas: StockDelta[];
    referenceType: 'invoice';
    referenceId: string;
    referenceLabel: string;
    createdBy: string | null;
  }
) {
  const { deltas, referenceType, referenceId, referenceLabel, createdBy } = params;

  const tasks = deltas.map(async (entry) => {
    const isDeduction = entry.delta > 0;
    const quantity = isDeduction ? -entry.delta : Math.abs(entry.delta);
    const transactionType = isDeduction ? 'sale' : 'return';

    const { error } = await supabase.rpc('log_stock_transaction', {
      p_product_id: entry.productId,
      p_transaction_type: transactionType,
      p_quantity: quantity,
      p_reference_type: referenceType,
      p_reference_id: referenceId,
      p_notes: referenceLabel,
      p_created_by: createdBy,
    });

    if (error) {
      throw new Error(error.message || 'Failed to adjust stock.');
    }
  });

  await Promise.all(tasks);
}

export async function getCurrentStaffId(supabase: SupabaseClient): Promise<string | null> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  return staff?.id ?? null;
}
