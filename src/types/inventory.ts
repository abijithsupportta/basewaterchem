export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryProduct {
  id: string;
  category_id?: string;
  category?: {
    id: string;
    name: string;
  };
  name: string;
  description?: string;
  sku?: string;
  unit_price: number;
  stock_quantity: number;
  min_stock_level?: number;
  unit_of_measure?: string;
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type StockTransactionType = 
  | 'purchase'
  | 'sale'
  | 'service'
  | 'adjustment'
  | 'return'
  | 'damage';

export interface StockTransaction {
  id: string;
  product_id: string;
  product?: {
    id: string;
    name: string;
    sku?: string;
  };
  transaction_type: StockTransactionType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}
