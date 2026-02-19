import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CompanySettings {
  company_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
}

interface ServicePdfData {
  service_number: string;
  service_type: string;
  status: string;
  scheduled_date?: string;
  completed_date?: string;
  work_done?: string;
  description?: string;
  parts_cost?: number;
  service_charge?: number;
  discount?: number;
  total_amount?: number;
  customer?: {
    full_name?: string;
    phone?: string;
    email?: string;
    address_line1?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  parts_used?: Array<{
    part_name?: string;
    name?: string;
    qty?: number;
    unit_price?: number;
    cost?: number;
  }>;
}

function formatMoney(amount: number): string {
  return `Rs ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0)}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function downloadServicePDF(service: ServicePdfData, company?: CompanySettings) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 16;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(company?.company_name || 'Base Water Chemicals', margin, y);
  doc.setFontSize(13);
  doc.text('SERVICE REPORT', pageWidth - margin, y, { align: 'right' });
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const companyLine = [company?.address_line1, company?.address_line2, company?.city, company?.state, company?.pincode].filter(Boolean).join(', ');
  if (companyLine) {
    doc.text(companyLine, margin, y);
    y += 5;
  }
  const companyContact = [company?.phone ? `Ph: ${company.phone}` : '', company?.email ? `Email: ${company.email}` : ''].filter(Boolean).join(' | ');
  if (companyContact) {
    doc.text(companyContact, margin, y);
    y += 5;
  }

  y += 3;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Service Details', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Service No: ${service.service_number || '-'}`, margin, y); y += 5;
  doc.text(`Type: ${service.service_type || '-'}`, margin, y); y += 5;
  doc.text(`Status: ${service.status || '-'}`, margin, y); y += 5;
  doc.text(`Scheduled Date: ${formatDate(service.scheduled_date)}`, margin, y); y += 5;
  doc.text(`Completed Date: ${formatDate(service.completed_date)}`, margin, y); y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Customer', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Name: ${service.customer?.full_name || '-'}`, margin, y); y += 5;
  doc.text(`Phone: ${service.customer?.phone || '-'}`, margin, y); y += 5;
  const customerAddr = [service.customer?.address_line1, service.customer?.city, service.customer?.state, service.customer?.pincode].filter(Boolean).join(', ');
  doc.text(`Address: ${customerAddr || '-'}`, margin, y); y += 7;

  const partRows = (service.parts_used || []).map((part, index) => {
    const qty = part.qty || 1;
    const unit = part.unit_price ?? part.cost ?? 0;
    return [
      String(index + 1),
      part.part_name || part.name || '-',
      String(qty),
      formatMoney(unit),
      formatMoney(qty * unit),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Item', 'Qty', 'Unit Price (Rs)', 'Amount (Rs)']],
    body: partRows.length ? partRows : [['-', 'No items', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 34 },
      4: { halign: 'right', cellWidth: 34 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Parts Cost: ${formatMoney(service.parts_cost || 0)}`, pageWidth - margin, y, { align: 'right' }); y += 5;
  doc.text(`Service Charge: ${formatMoney(service.service_charge || 0)}`, pageWidth - margin, y, { align: 'right' }); y += 5;
  doc.text(`Discount: - ${formatMoney(service.discount || 0)}`, pageWidth - margin, y, { align: 'right' }); y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${formatMoney(service.total_amount || 0)}`, pageWidth - margin, y, { align: 'right' });

  y += 10;
  if (service.work_done) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Work Done', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(service.work_done, pageWidth - margin * 2);
    doc.text(lines, margin, y);
  }

  doc.save(`${service.service_number || 'service-report'}.pdf`);
}
