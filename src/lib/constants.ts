export const APP_NAME = 'Base Water Chemicals';
export const APP_SHORT_NAME = 'BWC';
export const APP_DESCRIPTION = 'Service Management System for Aqua Filter Service & Sales';

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  staff: 'Staff',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  amc_service: 'Recurring Service',
  paid_service: 'Paid Service',
  installation: 'Installation',
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  overdue: 'Overdue',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  not_applicable: 'N/A (Free)',
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Paid',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Due',
  sent: 'Sent',
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export const TIME_SLOTS = ['Morning (9-12)', 'Afternoon (12-3)', 'Evening (3-6)'];

export const DEFAULT_TAX_PERCENT = 18; // GST

export const ITEMS_PER_PAGE = 20;

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Customers', href: '/dashboard/customers', icon: 'Users' },
  { label: 'Services', href: '/dashboard/services', icon: 'Wrench' },
  { label: 'Calendar', href: '/dashboard/services/calendar', icon: 'CalendarDays' },
  { label: 'Invoices', href: '/dashboard/invoices', icon: 'Receipt' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
];

export const STAFF_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'technician', label: 'Technician' },
];
