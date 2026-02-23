export const APP_NAME = 'Base Water Chemicals';
export const APP_SHORT_NAME = 'BWC';
export const APP_DESCRIPTION = 'Service Management System for Aqua Filter Service & Sales';

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  TECHNICIAN: 'technician',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrator',
  manager: 'Manager',
  staff: 'Staff',
  technician: 'Technician',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  amc_service: 'Recurring Service',
  paid_service: 'Paid Service',
  installation: 'Installation',
  free_service: 'Free Service',
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
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', roles: ['superadmin', 'admin', 'manager', 'technician'] },
  { label: 'Day Book', href: '/dashboard/day-book', icon: 'Wallet', roles: ['superadmin', 'admin', 'manager', 'staff', 'technician'] },
  { label: 'Customers', href: '/dashboard/customers', icon: 'Users', roles: ['superadmin', 'admin', 'manager', 'staff', 'technician'] },
  { label: 'Services', href: '/dashboard/services', icon: 'Wrench', roles: ['superadmin', 'admin', 'manager', 'staff', 'technician'] },
  { label: 'Calendar', href: '/dashboard/services/calendar', icon: 'CalendarDays', roles: ['superadmin', 'admin', 'manager', 'staff', 'technician'] },
  { label: 'Invoices', href: '/dashboard/invoices', icon: 'Receipt', roles: ['superadmin', 'admin', 'manager', 'staff'] },
  { label: 'Inventory', href: '/dashboard/inventory/products', icon: 'Package', roles: ['superadmin', 'admin', 'manager', 'staff'] },
  { label: 'Expenses', href: '/dashboard/expenses', icon: 'Wallet', roles: ['superadmin', 'admin', 'manager', 'staff'] },
  { label: 'Branches', href: '/dashboard/branches', icon: 'Building2', roles: ['superadmin', 'admin', 'manager'] },
  { label: 'Staff', href: '/dashboard/staff', icon: 'Users', roles: ['superadmin', 'admin', 'manager'] },
  { label: 'Settings', href: '/dashboard/settings', icon: 'Settings', roles: ['superadmin', 'admin', 'manager'] },
];

export const STAFF_ROLES = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'technician', label: 'Technician' },
];
