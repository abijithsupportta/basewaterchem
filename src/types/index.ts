export type { Customer, CustomerFormData, CustomerWithProducts } from './customer';
export type {
  Service,
  ServiceWithDetails,
  ServiceFormData,
  ServiceCompleteData,
  ServiceType,
  ServiceStatus,
  PaymentStatus,
  PartUsed,
  UpcomingServiceView,
} from './service';
export type {
  Invoice,
  InvoiceFormData,
  InvoiceItem,
  InvoiceItemFormData,
  InvoiceStatus,
  InvoiceWithDetails,
} from './invoice';
export type {
  Expense,
  ExpenseCategory,
  ExpenseFormData,
} from './expense';

// Dashboard stats
export interface DashboardStats {
  total_customers: number;
  scheduled_services: number;
  todays_services: number;
  overdue_services: number;
  this_week_services: number;
  pending_payments: number;
  revenue_this_month: number;
}
