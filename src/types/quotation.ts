export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

export interface QuotationItemFormData {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface Quotation {
  id: string;
  quotation_number: string | null;
  customer_id: string;
  title: string;
  valid_until: string | null;
  status: QuotationStatus;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  terms_and_conditions: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationFormData {
  customer_id: string;
  title: string;
  valid_until?: string;
  tax_percent?: number;
  discount_amount?: number;
  notes?: string;
  terms_and_conditions?: string;
  items: QuotationItemFormData[];
}

export interface QuotationWithDetails extends Quotation {
  customer: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    address_line1: string;
    city: string;
    customer_code: string;
  };
  items: QuotationItem[];
}
