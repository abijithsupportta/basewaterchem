/**
 * DEPRECATED: Use src/domain/services/pdf.service instead
 * This file is kept for backward compatibility during migration
 */

export { pdfService as default } from '@/domain/services/pdf.service';
export type {
  InvoiceItem,
  InvoiceData,
  CompanySettings,
  ServiceItem,
} from '@/domain/services/pdf.service';

// Re-export the instance methods as module functions for backward compatibility
import { pdfService } from '@/domain/services/pdf.service';

/**
 * @deprecated Use pdfService.generateInvoicePDF() from domain/services/pdf.service
 */
export const generateInvoicePDF = (invoice: any, items: any, company: any) => {
  return pdfService.generateInvoicePDF(invoice, items, company);
};

/**
 * @deprecated Use pdfService.generateInvoicePDF() and trigger download manually
 */
export const downloadInvoicePDF = (invoice: any, items: any, company: any) => {
  try {
    const doc = pdfService.generateInvoicePDF(invoice, items, company);
    const fileName = `Invoice_${invoice.invoice_number}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error('Error downloading invoice PDF:', error);
  }
};

/**
 * @deprecated Use pdfService.generateServiceReportPDF() from domain/services/pdf.service
 */
export const generateServiceReportPDF = (service: any, customer: any, company: any) => {
  return pdfService.generateServiceReportPDF(service, customer, company);
};
