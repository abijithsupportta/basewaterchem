export type AmcStatus = 'active' | 'expired' | 'cancelled' | 'pending_renewal';

export interface AmcContract {
  id: string;
  contract_number: string | null;
  customer_id: string;
  customer_product_id: string | null;
  invoice_id: string | null;
  start_date: string;
  end_date: string;
  service_interval_months: number;
  total_services_included: number;
  services_completed: number;
  amount: number;
  is_paid: boolean;
  status: AmcStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmcFormData {
  customer_id: string;
  customer_product_id?: string;
  invoice_id?: string;
  start_date: string;
  end_date: string;
  service_interval_months?: number;
  total_services_included?: number;
  amount: number;
  notes?: string;
}

export interface AmcContractWithDetails extends AmcContract {
  customer: {
    id: string;
    full_name: string;
    phone: string;
    customer_code: string;
  };
  invoice?: {
    id: string;
    invoice_number: string;
    total_amount: number;
  } | null;
}
