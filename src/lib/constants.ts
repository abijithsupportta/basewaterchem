export const APP_NAME = 'Base Water Chemicals';
export const APP_SHORT_NAME = 'BWC';
export const APP_DESCRIPTION = 'Service Management System for Aqua Filter Service & Sales';

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  TECHNICIAN: 'technician',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  staff: 'Staff',
  technician: 'Technician',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  amc_service: 'AMC Service',
  paid_service: 'Paid Service',
  installation: 'Installation',
  complaint_service: 'Complaint Service',
  warranty_service: 'Warranty Service',
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  not_applicable: 'N/A (Free)',
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Paid',
};

export const COMPLAINT_PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  escalated: 'Escalated',
};

export const AMC_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
  pending_renewal: 'Pending Renewal',
};

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  water_purifier: 'Water Purifier',
  water_filter: 'Water Filter',
  water_softener: 'Water Softener',
  spare_part: 'Spare Part',
  consumable: 'Consumable',
  accessory: 'Accessory',
  other: 'Other',
};

export const TIME_SLOTS = ['Morning (9-12)', 'Afternoon (12-3)', 'Evening (3-6)'];

export const DEFAULT_TAX_PERCENT = 18; // GST

export const ITEMS_PER_PAGE = 20;

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', roles: ['admin', 'manager', 'staff', 'technician'] },
  { label: 'Customers', href: '/dashboard/customers', icon: 'Users', roles: ['admin', 'manager', 'staff'] },
  { label: 'Products', href: '/dashboard/products', icon: 'Package', roles: ['admin', 'manager', 'staff'] },
  { label: 'Services', href: '/dashboard/services', icon: 'Wrench', roles: ['admin', 'manager', 'staff', 'technician'] },
  { label: 'AMC', href: '/dashboard/amc', icon: 'FileCheck', roles: ['admin', 'manager', 'staff'] },
  { label: 'Complaints', href: '/dashboard/complaints', icon: 'AlertTriangle', roles: ['admin', 'manager', 'staff', 'technician'] },
  { label: 'Quotations', href: '/dashboard/quotations', icon: 'FileText', roles: ['admin', 'manager', 'staff'] },
  { label: 'Invoices', href: '/dashboard/invoices', icon: 'Receipt', roles: ['admin', 'manager', 'staff'] },
  { label: 'Technicians', href: '/dashboard/technicians', icon: 'HardHat', roles: ['admin', 'manager'] },
  { label: 'Staff', href: '/dashboard/staff', icon: 'UserCog', roles: ['admin'] },
  { label: 'Reports', href: '/dashboard/reports', icon: 'BarChart3', roles: ['admin', 'manager'] },
  { label: 'Notifications', href: '/dashboard/notifications', icon: 'Bell', roles: ['admin', 'manager', 'staff', 'technician'] },
  { label: 'Settings', href: '/dashboard/settings', icon: 'Settings', roles: ['admin'] },
];
