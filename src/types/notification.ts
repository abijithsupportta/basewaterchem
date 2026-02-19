export type NotificationType =
  | 'service_due'
  | 'service_overdue'
  | 'amc_expiring'
  | 'amc_expired'
  | 'complaint_assigned'
  | 'complaint_updated'
  | 'warranty_expiring'
  | 'payment_due'
  | 'general';

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  related_id: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_customers: number;
  scheduled_services: number;
  todays_services: number;
  overdue_services: number;
  this_week_services: number;
  pending_payments: number;
  revenue_this_month: number;
}
