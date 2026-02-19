export type ProductCategory =
  | 'water_purifier'
  | 'water_filter'
  | 'water_softener'
  | 'spare_part'
  | 'consumable'
  | 'accessory'
  | 'other';

export type InstallationStatus = 'active' | 'inactive' | 'removed';

export interface Product {
  id: string;
  product_code: string | null;
  name: string;
  category: ProductCategory;
  brand: string | null;
  model: string | null;
  description: string | null;
  price: number;
  warranty_months: number;
  amc_interval_months: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductFormData {
  name: string;
  category: ProductCategory;
  brand?: string;
  model?: string;
  description?: string;
  price: number;
  warranty_months?: number;
  amc_interval_months?: number;
}

export interface CustomerProduct {
  id: string;
  customer_id: string;
  product_id: string;
  serial_number: string | null;
  installation_date: string;
  warranty_end_date: string | null;
  purchase_price: number | null;
  status: InstallationStatus;
  location_in_premises: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerProductFormData {
  customer_id: string;
  product_id: string;
  serial_number?: string;
  installation_date: string;
  purchase_price?: number;
  location_in_premises?: string;
  notes?: string;
}

export interface CustomerProductWithProduct extends CustomerProduct {
  product: Product;
}
