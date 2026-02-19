/**
 * PDF Generation Service - Domain Layer
 * Pure business logic for PDF document generation
 * Framework-independent, easily testable
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceItem {
  item_name?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  status: string;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes?: string;
  payment_method?: string;
  customer: {
    full_name: string;
    phone?: string;
    email?: string;
    address_line1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    customer_code?: string;
  };
}

export interface CompanySettings {
  company_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gst_number: string;
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
}

export interface ServiceItem {
  service_id: string;
  service_type: string;
  scheduled_date: string;
  completed_date?: string;
  amount: number;
  parts?: { name: string; cost: number }[];
}

class PDFService {
  /**
   * Format amount to INR format (XX,XX,XXX.XX)
   */
  private formatINR(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Get money display format (Rs XX,XX,XXX.XX)
   */
  private formatMoney(amount: number): string {
    return `Rs ${this.formatINR(amount)}`;
  }

  /**
   * Format date string to DD MMM YYYY
   */
  private formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Convert number to words (Rupees format)
   */
  private numberToWords(num: number): string {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convert = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);

    let result = 'Rupees ' + convert(rupees);
    if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
    result += ' Only';
    return result;
  }

  /**
   * Generate Invoice PDF
   */
  generateInvoicePDF(
    invoice: InvoiceData,
    items: InvoiceItem[],
    company: CompanySettings
  ): jsPDF {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // ─── Header ───
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(company.company_name || 'Base Water Chemicals', margin, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const companyAddr = [company.address_line1, company.address_line2, company.city, company.state, company.pincode].filter(Boolean).join(', ');
    if (companyAddr) doc.text(companyAddr, margin, 21);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth - margin, 14, { align: 'right' });

    if (company.gst_number) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('GSTIN: ' + company.gst_number, pageWidth - margin, 21, { align: 'right' });
    }

    y = 40;
    doc.setTextColor(0, 0, 0);

    // ─── Invoice & Customer Info (side by side) ───
    const boxHeight = 38;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth / 2 - 3, boxHeight);
    doc.rect(margin + contentWidth / 2 + 3, y, contentWidth / 2 - 3, boxHeight);

    // Left box: Invoice details
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('INVOICE DETAILS', margin + 4, y + 6);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Invoice #:', margin + 4, y + 13);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.invoice_number, margin + 30, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.text('Date:', margin + 4, y + 19);
    doc.text(this.formatDate(invoice.invoice_date), margin + 30, y + 19);

    if (invoice.due_date) {
      doc.text('Due Date:', margin + 4, y + 25);
      doc.text(this.formatDate(invoice.due_date), margin + 30, y + 25);
    }

    doc.text('Status:', margin + 4, y + 31);
    const statusLabel = invoice.status === 'draft' ? 'Due' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);
    doc.setFont('helvetica', 'bold');
    if (invoice.status === 'paid') doc.setTextColor(16, 185, 129);
    else if (invoice.status === 'draft' || invoice.status === 'overdue') doc.setTextColor(220, 38, 38);
    else doc.setTextColor(245, 158, 11);
    doc.text(statusLabel, margin + 30, y + 31);
    doc.setTextColor(0, 0, 0);

    // Right box: Customer details
    const rightX = margin + contentWidth / 2 + 7;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('BILL TO', rightX, y + 6);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.customer.full_name, rightX, y + 13);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let custY = y + 19;
    if (invoice.customer.customer_code) {
      doc.setFont('helvetica', 'bold');
      doc.text(invoice.customer.customer_code, rightX, custY);
      doc.setFont('helvetica', 'normal');
      custY += 5;
    }
    if (invoice.customer.address_line1) {
      doc.text(invoice.customer.address_line1, rightX, custY);
      custY += 5;
    }
    const custCityLine = [invoice.customer.city, invoice.customer.state, invoice.customer.pincode].filter(Boolean).join(', ');
    if (custCityLine) {
      doc.text(custCityLine, rightX, custY);
      custY += 5;
    }
    if (invoice.customer.phone) doc.text('Ph: ' + invoice.customer.phone, rightX, custY);

    y += boxHeight + 8;

    // ─── Items Table ───
    const tableRows = items.map((item, idx) => [
      (idx + 1).toString(),
      item.item_name || item.description || '-',
      item.quantity.toString(),
      this.formatINR(item.unit_price),
      this.formatINR(item.total_price),
    ]);

    (autoTable as any)(doc, {
      startY: y,
      head: [['#', 'Description', 'Qty', 'Rate (Rs)', 'Amount (Rs)']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 32 },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // ─── Totals Section ───
    const totalsX = pageWidth - margin - 70;
    const valuesX = pageWidth - margin;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    doc.text('Subtotal:', totalsX, y, { align: 'left' });
    doc.text(this.formatMoney(invoice.subtotal), valuesX, y, { align: 'right' });
    y += 6;

    if (invoice.tax_amount > 0) {
      doc.text(`GST (${invoice.tax_percent}%):`, totalsX, y, { align: 'left' });
      doc.text(this.formatMoney(invoice.tax_amount), valuesX, y, { align: 'right' });
      y += 6;
    }

    if (invoice.discount_amount > 0) {
      doc.text('Discount:', totalsX, y, { align: 'left' });
      doc.text('-' + this.formatMoney(invoice.discount_amount), valuesX, y, { align: 'right' });
      y += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setDrawColor(0);
    doc.line(totalsX - 2, y - 2, pageWidth - margin, y - 2);
    doc.text('TOTAL AMOUNT DUE:', totalsX, y + 5, { align: 'left' });
    doc.text(this.formatMoney(invoice.total_amount), valuesX, y + 5, { align: 'right' });
    doc.line(totalsX - 2, y + 7, pageWidth - margin, y + 7);

    y += 15;

    // ─── Amount in Words ───
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Amount in Words:', margin, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(this.numberToWords(invoice.total_amount), margin + 35, y);

    y += 10;

    // ─── Notes & Bank Details ───
    if (invoice.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Notes:', margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(invoice.notes, contentWidth);
      doc.text(splitNotes, margin, y);
      y += splitNotes.length * 4 + 4;
    }

    // Bank details
    if (company.bank_name) {
      doc.setFontSize(8);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, contentWidth, 20);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('Bank Details', margin + 4, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Bank Name: ' + company.bank_name, margin + 4, y + 10);
      doc.text('Account: ' + company.bank_account, margin + 4, y + 14);
      if (company.bank_ifsc) doc.text('IFSC: ' + company.bank_ifsc, margin + 4, y + 18);
    }

    return doc;
  }

  /**
   * Generate Service Report PDF
   */
  generateServiceReportPDF(
    service: ServiceItem,
    customer: { full_name: string; phone?: string; address?: string },
    company: CompanySettings
  ): jsPDF {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // ─── Header ───
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, pageWidth, 25, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICE REPORT', margin, 14);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(company.company_name || 'Base Water Chemicals', margin, 19);

    let y = 32;

    // ─── Service & Customer Info ───
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Service Details', margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Service ID: ' + service.service_id, margin, y);
    y += 5;
    doc.text('Type: ' + service.service_type, margin, y);
    y += 5;
    doc.text('Scheduled: ' + this.formatDate(service.scheduled_date), margin, y);
    if (service.completed_date) {
      y += 5;
      doc.text('Completed: ' + this.formatDate(service.completed_date), margin, y);
    }

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Details', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.text('Name: ' + customer.full_name, margin, y);
    y += 5;
    if (customer.phone) {
      doc.text('Phone: ' + customer.phone, margin, y);
      y += 5;
    }
    if (customer.address) {
      const splitAddr = doc.splitTextToSize(customer.address, 150);
      doc.text(splitAddr, margin, y);
      y += splitAddr.length * 4 + 5;
    }

    // ─── Parts & Charges Table ───
    if (service.parts && service.parts.length > 0) {
      y += 3;
      const tableData = service.parts.map((part) => [part.name, this.formatMoney(part.cost)]);

      (autoTable as any)(doc, {
        startY: y,
        head: [['Part/Item', 'Cost (Rs)']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 9,
        },
        margin: { left: margin, right: margin },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ─── Total Amount ───
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Amount:', margin, y);
    doc.text(this.formatMoney(service.amount), pageWidth - margin, y, { align: 'right' });

    return doc;
  }
}

// Export singleton instance
export const pdfService = new PDFService();
