export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'cancelled';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  item_name: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

export interface InvoiceItemFormData {
  product_id?: string;
  item_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: string;
  invoice_number: string | null;
  customer_id: string;
  service_id: string | null;
  quotation_id: string | null;
  invoice_date: string;

  status: InvoiceStatus;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_method: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  amc_enabled: boolean;
  amc_period_months: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFormData {
  customer_id: string;
  service_id?: string;
  quotation_id?: string;
  invoice_date?: string;

  tax_percent?: number;
  discount_amount?: number;
  notes?: string;
  amc_enabled?: boolean;
  amc_period_months?: number;
  items: InvoiceItemFormData[];
}

export interface InvoiceWithDetails extends Invoice {
  customer: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    address_line1: string;
    city: string;
    customer_code: string;
  };
  items: InvoiceItem[];
}
