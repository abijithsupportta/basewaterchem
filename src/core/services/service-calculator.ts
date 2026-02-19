import type { ServiceCompleteData } from '@/types';

/**
 * Pure business logic for service operations.
 * Framework-independent, easily testable.
 */
export class ServiceCalculator {
  /**
   * Calculate total service amount from parts cost and service charge
   */
  static calculateTotal(completeData: ServiceCompleteData): number {
    return (completeData.parts_cost || 0) + (completeData.service_charge || 0);
  }

  /**
   * Build the complete update payload for service completion
   */
  static buildCompletionPayload(completeData: ServiceCompleteData) {
    return {
      ...completeData,
      status: 'completed' as const,
      completed_date: completeData.completed_date || new Date().toISOString().split('T')[0],
      total_amount: ServiceCalculator.calculateTotal(completeData),
    };
  }
}
