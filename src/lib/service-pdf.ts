/**
 * DEPRECATED: Use src/domain/services/pdf.service instead
 * This file is kept for backward compatibility during migration
 */

export { pdfService as default } from '@/domain/services/pdf.service';
export type {
  ServiceItem,
  CompanySettings,
} from '@/domain/services/pdf.service';

// Re-export the instance methods as module functions for backward compatibility
import { pdfService } from '@/domain/services/pdf.service';

/**
 * @deprecated Use pdfService.generateServiceReportPDF() from domain/services/pdf.service
 */
export const generateServiceReportPDF = (service: any, customer: any, company?: any) => {
  // Support both 2 and 3 argument patterns for backward compatibility
  if (company === undefined) {
    // 2-argument pattern: service contains customer data
    company = customer;
    customer = service.customer || service;
  }
  return pdfService.generateServiceReportPDF(service, customer, company);
};

/**
 * @deprecated Use pdfService.generateServiceReportPDF() and trigger download manually
 * Supports both 2 and 3 argument patterns
 */
export const downloadServicePDF = (service: any, customerOrCompany?: any, company?: any) => {
  try {
    // Support both 2 and 3 argument patterns for backward compatibility
    let actualCustomer: any;
    let actualCompany: any;
    
    if (company === undefined) {
      // 2-argument pattern: serviceOrCustomer = full service object, customerOrCompany = company settings
      actualCustomer = service.customer || service;
      actualCompany = customerOrCompany;
    } else {
      // 3-argument pattern: service, customer, company
      actualCustomer = customerOrCompany;
      actualCompany = company;
    }
    
    const doc = pdfService.generateServiceReportPDF(service, actualCustomer, actualCompany);
    const fileName = `Service_${service.service_id || service.id}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error('Error downloading service PDF:', error);
  }
};
