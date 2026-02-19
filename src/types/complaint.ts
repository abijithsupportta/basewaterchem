export type ComplaintStatus =
  | 'open'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'escalated';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Complaint {
  id: string;
  complaint_number: string | null;
  customer_id: string;
  customer_product_id: string | null;
  title: string;
  description: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  is_under_warranty: boolean;
  assigned_to: string | null;
  resolved_date: string | null;
  resolution_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplaintFormData {
  customer_id: string;
  customer_product_id?: string;
  title: string;
  description: string;
  priority?: ComplaintPriority;
  is_under_warranty?: boolean;
  assigned_to?: string;
}

export interface ComplaintWithDetails extends Complaint {
  customer: {
    id: string;
    full_name: string;
    phone: string;
    customer_code: string;
  };
  customer_product?: {
    id: string;
    product: {
      name: string;
      brand: string | null;
      model: string | null;
    };
  };
  assigned_staff?: {
    id: string;
    full_name: string;
    phone: string;
  };
}
