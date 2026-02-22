/**
 * DEPRECATED: Use src/shared/utils instead
 * This file is kept for backward compatibility during migration
 * All utilities have been moved to src/shared/utils/format.ts
 */

export {
  cn,
  formatDate,
  formatDateTime,
  formatRelativeDate,
  formatCurrency,
  formatPhone,
  isOverdue,
  isExpiringSoon,
  getServiceTypeLabel,
  isFreeServiceActive,
  getFreeServiceValidUntil,
  getStatusColor,
  getEffectiveServiceStatus,
  truncate,
  parseQueryParams,
  buildQueryString,
  debounce,
  throttle,
  isEmpty,
  deepClone,
} from '@/shared/utils/format';
