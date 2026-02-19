import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isAfter, isBefore, addMonths } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy, hh:mm a');
}

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPhone(phone: string): string {
  if (phone.length === 10) {
    return `${phone.slice(0, 5)} ${phone.slice(5)}`;
  }
  return phone;
}

export function isOverdue(date: string | Date): boolean {
  return isBefore(new Date(date), new Date());
}

export function isExpiringSoon(date: string | Date, daysThreshold = 30): boolean {
  const thresholdDate = addMonths(new Date(), 1);
  const targetDate = new Date(date);
  return isAfter(targetDate, new Date()) && isBefore(targetDate, thresholdDate);
}

export function getServiceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    amc_service: 'AMC Service',
    paid_service: 'Paid Service',
    installation: 'Installation',
    complaint_service: 'Complaint Service',
    warranty_service: 'Warranty Service',
  };
  return labels[type] || type;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Service statuses
    scheduled: 'bg-blue-100 text-blue-800',
    assigned: 'bg-indigo-100 text-indigo-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
    rescheduled: 'bg-orange-100 text-orange-800',
    // AMC statuses
    active: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    pending_renewal: 'bg-amber-100 text-amber-800',
    // Complaint statuses
    open: 'bg-red-100 text-red-800',
    acknowledged: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
    escalated: 'bg-red-100 text-red-800',
    // Payment statuses
    not_applicable: 'bg-gray-100 text-gray-600',
    pending: 'bg-yellow-100 text-yellow-800',
    partial: 'bg-orange-100 text-orange-800',
    paid: 'bg-green-100 text-green-800',
    // Complaint priority
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
    // Quotation/Invoice
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    converted: 'bg-purple-100 text-purple-800',
    overdue: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Returns 'overdue' if a service is scheduled/assigned but its date has passed,
 * otherwise returns the original status.
 */
export function getEffectiveServiceStatus(status: string, scheduledDate: string | Date): string {
  if ((status === 'scheduled' || status === 'assigned') && isBefore(new Date(scheduledDate), new Date(new Date().toDateString()))) {
    return 'overdue';
  }
  return status;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
