/**
 * Shared Utility Functions - Reusable, No Domain Dependencies
 * Pure functions for formatting, display, and data transformation
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isAfter, isBefore, addMonths, differenceInCalendarDays } from 'date-fns';

/**
 * Merge CSS classes with Tailwind priority
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to "dd MMM yyyy" (e.g., "01 Jan 2024")
 */
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy');
}

/**
 * Format date/time to "dd MMM yyyy, hh:mm a" (e.g., "01 Jan 2024, 02:30 pm")
 */
export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy, hh:mm a');
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/**
 * Format amount as INR currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format phone number with space (10 digits)
 */
export function formatPhone(phone: string): string {
  if (phone.length === 10) {
    return `${phone.slice(0, 5)} ${phone.slice(5)}`;
  }
  return phone;
}

/**
 * Check if a date is in the past
 */
export function isOverdue(date: string | Date): boolean {
  return isBefore(new Date(date), new Date());
}

/**
 * Check if a date is expiring within N days
 */
export function isExpiringSoon(date: string | Date, daysThreshold = 30): boolean {
  const thresholdDate = addMonths(new Date(), Math.ceil(daysThreshold / 30));
  const targetDate = new Date(date);
  return isAfter(targetDate, new Date()) && isBefore(targetDate, thresholdDate);
}

/**
 * Get human-readable label for service type
 */
export function getServiceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    amc_service: 'AMC Service',
    paid_service: 'Paid Service',
    installation: 'Installation',
    free_service: 'Free Service',
    complaint_service: 'Complaint Service',
    warranty_service: 'Warranty Service',
  };
  return labels[type] || type;
}

export function isFreeServiceActive(service: {
  service_type?: string | null;
  free_service_valid_until?: string | Date | null;
  scheduled_date?: string | Date | null;
  created_at?: string | Date | null;
}): boolean {
  const expiryDate = getFreeServiceValidUntil(service);
  if (!expiryDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const serviceDate = service.scheduled_date
    ?? service.created_at
    ?? today;

  const serviceDay = new Date(serviceDate);
  serviceDay.setHours(0, 0, 0, 0);

  return expiryDate >= today && serviceDay <= expiryDate;
}

export function getFreeServiceValidUntil(service: {
  service_type?: string | null;
  free_service_valid_until?: string | Date | null;
  scheduled_date?: string | Date | null;
  created_at?: string | Date | null;
}): Date | null {
  if (service.free_service_valid_until) {
    return new Date(service.free_service_valid_until);
  }

  if (service.service_type !== 'free_service') return null;

  const expirySource = service.scheduled_date
    ?? service.created_at;

  if (!expirySource) return null;

  const computed = new Date(expirySource);
  computed.setDate(computed.getDate() + 365);
  return computed;
}

export function getFreeServiceDaysLeft(service: {
  free_service_valid_until?: string | Date | null;
  service_type?: string | null;
  scheduled_date?: string | Date | null;
  created_at?: string | Date | null;
}): number | null {
  const expiryDate = getFreeServiceValidUntil(service);
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInCalendarDays(expiryDate, today);
  return Math.max(0, diff);
}

/**
 * Get Tailwind CSS color classes for status badges
 */
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
    draft: 'bg-red-100 text-red-800',
    sent: 'bg-blue-100 text-blue-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    converted: 'bg-purple-100 text-purple-800',
    overdue: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get effective service status, marking overdue scheduled /assigned services
 */
export function getEffectiveServiceStatus(status: string, scheduledDate: string | Date): string {
  if ((status === 'scheduled' || status === 'assigned') && isBefore(new Date(scheduledDate), new Date(new Date().toDateString()))) {
    return 'overdue';
  }
  return status;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Parse query parameters from URL search string
 */
export function parseQueryParams(searchString: string): Record<string, string> {
  const params = new URLSearchParams(searchString);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, string | number | boolean>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

/**
 * Debounce function for event handlers
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function for event handlers
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Check if value is empty (null, undefined, empty string/array/object)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (obj instanceof Object) {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}
