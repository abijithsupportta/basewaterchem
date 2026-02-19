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
export type { AmcContract, AmcFormData, AmcStatus, AmcContractWithDetails } from './amc';
export type {
  Invoice,
  InvoiceFormData,
  InvoiceItem,
  InvoiceItemFormData,
  InvoiceStatus,
  InvoiceWithDetails,
} from './invoice';

// Dashboard stats
export interface DashboardStats {
  total_customers: number;
  active_amc_contracts: number;
  todays_services: number;
  overdue_services: number;
  this_week_services: number;
  amc_expiring_soon: number;
  pending_payments: number;
  amc_services_this_month: number;
  amc_services_this_week: number;
  revenue_this_month: number;
}
