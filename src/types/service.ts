import type { AmcContract } from './amc';

export type ServiceType =
  | 'amc_service'
  | 'paid_service'
  | 'installation';

export type ServiceStatus =
  | 'scheduled'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export type PaymentStatus = 'not_applicable' | 'pending' | 'partial' | 'paid';

export interface PartUsed {
  part_id: string;
  part_name: string;
  qty: number;
  cost: number;
}

export interface Service {
  id: string;
  service_number: string | null;
  customer_id: string;
  customer_product_id: string | null;
  amc_contract_id: string | null;
  complaint_id: string | null;
  service_type: ServiceType;
  status: ServiceStatus;
  scheduled_date: string;
  scheduled_time_slot: string | null;
  completed_date: string | null;
  assigned_technician_id: string | null;
  description: string | null;
  work_done: string | null;
  parts_used: PartUsed[];
  parts_cost: number;
  service_charge: number;
  total_amount: number;
  is_under_warranty: boolean;
  is_under_amc: boolean;
  payment_status: PaymentStatus;
  customer_feedback: string | null;
  customer_rating: number | null;
  technician_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceWithDetails extends Service {
  customer?: {
    id: string;
    full_name: string;
    phone: string;
    customer_code: string;
    address_line1?: string;
    city?: string;
  } | null;
  customer_product?: {
    id: string;
    serial_number?: string;
    product?: {
      id?: string;
      name: string;
      brand?: string;
      model?: string;
    } | null;
  } | null;
  technician?: {
    id: string;
    full_name: string;
    phone?: string;
  } | null;
  amc_contract?: AmcContract | null;
}

export interface ServiceFormData {
  customer_id: string;
  customer_product_id?: string;
  amc_contract_id?: string;
  service_type: ServiceType;
  scheduled_date: string;
  scheduled_time_slot?: string;
  description?: string;
  is_under_amc?: boolean;
}

export interface ServiceCompleteData {
  completed_date: string;
  work_done: string;
  parts_used?: PartUsed[];
  parts_cost?: number;
  service_charge?: number;
  total_amount?: number;
  payment_status?: PaymentStatus;
  technician_notes?: string;
}

export interface UpcomingServiceView {
  id: string;
  service_number: string;
  scheduled_date: string;
  scheduled_time_slot: string | null;
  service_type: ServiceType;
  status: ServiceStatus;
  is_under_amc: boolean;
  customer_id: string;
  customer_code: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  amc_contract_number: string | null;
  payment_status: PaymentStatus;
}
