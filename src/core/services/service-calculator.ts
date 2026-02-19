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
      total_amount: ServiceCalculator.calculateTotal(completeData),
    };
  }

  /**
   * Build the update payload for technician assignment
   */
  static buildAssignmentPayload(technicianId: string) {
    return {
      assigned_technician_id: technicianId,
      status: 'assigned' as const,
    };
  }
}
