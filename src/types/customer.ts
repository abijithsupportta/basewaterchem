export interface Customer {
  id: string;
  customer_code: string | null;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  district: string;
  state: string;
  pincode: string | null;
  location_landmark: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerFormData {
  full_name: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  address_line1: string;
  address_line2?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  location_landmark?: string;
  notes?: string;
}

export interface CustomerWithProducts extends Customer {
  customer_products: CustomerProductWithProduct[];
}

import { CustomerProductWithProduct } from './product';
