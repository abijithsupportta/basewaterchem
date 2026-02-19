import { DEFAULT_TAX_PERCENT } from '@/lib/constants';
import type { InvoiceItemFormData } from '@/types';

/**
 * Pure business logic for invoice calculations.
 * Framework-independent, easily testable.
 */
export class InvoiceCalculator {
  /**
   * Calculate invoice totals from line items
   */
  static calculate(
    items: InvoiceItemFormData[],
    taxPercent: number = DEFAULT_TAX_PERCENT,
    discountAmount: number = 0
  ) {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const taxAmount = subtotal * (taxPercent / 100);
    const totalAmount = subtotal + taxAmount - discountAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax_amount: Math.round(taxAmount * 100) / 100,
      total_amount: Math.round(totalAmount * 100) / 100,
    };
  }

  /**
   * Calculate line item total
   */
  static itemTotal(quantity: number, unitPrice: number): number {
    return Math.round(quantity * unitPrice * 100) / 100;
  }

  /**
   * Calculate payment status after recording a payment
   */
  static paymentStatus(
    totalAmount: number,
    currentPaid: number,
    newPayment: number
  ): { amountPaid: number; balanceDue: number; status: 'paid' | 'partial' } {
    const amountPaid = currentPaid + newPayment;
    const balanceDue = Math.max(0, totalAmount - amountPaid);
    const status = balanceDue <= 0 ? 'paid' : 'partial';

    return { amountPaid, balanceDue, status };
  }
}
