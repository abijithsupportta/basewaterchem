import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CompanySettings {
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

interface InvoiceItem {
  item_name?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface InvoiceData {
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

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMoney(amount: number): string {
  return `Rs ${formatINR(amount)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = 'Rupees ' + convert(rupees);
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  result += ' Only';
  return result;
}

export function generateInvoicePDF(
  invoice: InvoiceData,
  items: InvoiceItem[],
  company: CompanySettings
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ─── Header: Company Name + TAX INVOICE ───
  doc.setFillColor(30, 64, 175); // Blue header
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(company.company_name || 'Base Water Chemicals', margin, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const companyAddr = [company.address_line1, company.address_line2, company.city, company.state, company.pincode].filter(Boolean).join(', ');
  if (companyAddr) doc.text(companyAddr, margin, 21);
  const companyContact = [company.phone ? 'Ph: ' + company.phone : '', company.email ? 'Email: ' + company.email : ''].filter(Boolean).join(' | ');
  if (companyContact) doc.text(companyContact, margin, 27);

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

  // ─── Invoice Info + Customer Info (side by side) ───
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
  doc.text(formatDate(invoice.invoice_date), margin + 30, y + 19);

  if (invoice.due_date) {
    doc.text('Due Date:', margin + 4, y + 25);
    doc.text(formatDate(invoice.due_date), margin + 30, y + 25);
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
    doc.text(invoice.customer.customer_code, rightX, custY);
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
    formatINR(item.unit_price),
    formatINR(item.total_price),
  ]);

  autoTable(doc, {
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

  // ─── Totals Section (right-aligned) ───
  const totalsX = pageWidth - margin - 70;
  const valuesX = pageWidth - margin;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.text('Subtotal:', totalsX, y, { align: 'left' });
  doc.text(formatMoney(invoice.subtotal), valuesX, y, { align: 'right' });
  y += 6;

  if (invoice.tax_amount > 0) {
    doc.text(`GST (${invoice.tax_percent}%):`, totalsX, y, { align: 'left' });
    doc.text(formatMoney(invoice.tax_amount), valuesX, y, { align: 'right' });
    y += 6;
  }

  if (invoice.discount_amount > 0) {
    doc.text('Discount:', totalsX, y, { align: 'left' });
    doc.text(`- ${formatMoney(invoice.discount_amount)}`, valuesX, y, { align: 'right' });
    y += 6;
  }

  // Total line
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 2, y - 1, valuesX, y - 1);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', totalsX, y + 5, { align: 'left' });
  doc.text(formatMoney(invoice.total_amount), valuesX, y + 5, { align: 'right' });
  y += 10;

  if (invoice.amount_paid > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129);
    doc.text('Amount Paid:', totalsX, y + 2, { align: 'left' });
    doc.text(formatMoney(invoice.amount_paid), valuesX, y + 2, { align: 'right' });
    y += 6;
    doc.setTextColor(0, 0, 0);
  }

  if (invoice.balance_due > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('Balance Due:', totalsX, y + 2, { align: 'left' });
    doc.text(formatMoney(invoice.balance_due), valuesX, y + 2, { align: 'right' });
    y += 8;
    doc.setTextColor(0, 0, 0);
  }

  // ─── Amount in Words ───
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('AMOUNT IN WORDS', margin, y);
  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(numberToWords(invoice.total_amount), margin, y);
  y += 10;

  // ─── Bank Details (if provided) ───
  if (company.bank_name || company.bank_account) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('BANK DETAILS', margin, y);
    y += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (company.bank_name) { doc.text('Bank: ' + company.bank_name, margin, y); y += 5; }
    if (company.bank_account) { doc.text('A/C No: ' + company.bank_account, margin, y); y += 5; }
    if (company.bank_ifsc) { doc.text('IFSC: ' + company.bank_ifsc, margin, y); y += 5; }
    y += 5;
  }

  // ─── Notes ───
  if (invoice.notes) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('NOTES', margin, y);
    y += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(invoice.notes, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 5;
  }

  // ─── Signature area ───
  const sigY = Math.max(y + 10, 250);
  doc.setDrawColor(200, 200, 200);
  doc.line(pageWidth - margin - 60, sigY, pageWidth - margin, sigY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Authorized Signatory', pageWidth - margin - 30, sigY + 5, { align: 'center' });

  // ─── Footer ───
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('This is a computer-generated invoice.', pageWidth / 2, 285, { align: 'center' });
  doc.text('Thank you for your business!', pageWidth / 2, 289, { align: 'center' });

  return doc;
}

export function downloadInvoicePDF(
  invoice: InvoiceData,
  items: InvoiceItem[],
  company: CompanySettings
) {
  const doc = generateInvoicePDF(invoice, items, company);
  doc.save(`${invoice.invoice_number}.pdf`);
}
