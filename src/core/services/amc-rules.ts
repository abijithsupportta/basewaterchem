/**
 * Pure business logic for AMC contract operations.
 * Framework-independent, easily testable.
 */
export class AmcContractRules {
  /**
   * Build the renewal payload — resets contract state for a new period
   */
  static buildRenewalPayload(newEndDate: string, amount: number) {
    return {
      end_date: newEndDate,
      amount,
      status: 'active' as const,
      services_completed: 0,
      is_paid: false,
    };
  }
}
