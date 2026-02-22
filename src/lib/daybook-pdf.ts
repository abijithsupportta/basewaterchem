import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DayBookSummary = {
  sales: number;
  services: number;
  revenue: number;
  expenses: number;
  dues: number;
  collected: number;
  profit: number;
};

type DayBookRows = {
  invoices: Array<{ invoice_number?: string; invoice_date: string; customer_name?: string; total_amount?: number; amount_paid?: number; balance_due?: number }>;
  services: Array<{ service_number?: string; scheduled_date: string; customer_name?: string; status?: string; total_amount?: number; payment_status?: string }>;
  expenses: Array<{ expense_date: string; title: string; category: string; amount: number; payment_method?: string | null }>;
};

export function downloadDayBookPDF(params: {
  periodLabel: string;
  from?: string;
  to?: string;
  summary: DayBookSummary;
  rows: DayBookRows;
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Day Book Statement', margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateLabel = params.from && params.to ? `${params.from} to ${params.to}` : params.periodLabel;
  doc.text(`Period: ${params.periodLabel} (${dateLabel})`, margin, y);
  y += 7;

  const summaryRows = [
    ['Sales', params.summary.sales.toFixed(2)],
    ['Services', String(params.summary.services)],
    ['Revenue', params.summary.revenue.toFixed(2)],
    ['Expenses', params.summary.expenses.toFixed(2)],
    ['Dues', params.summary.dues.toFixed(2)],
    ['Collected', params.summary.collected.toFixed(2)],
    ['Profit', params.summary.profit.toFixed(2)],
  ];

  (autoTable as any)(doc, {
    startY: y,
    head: [['Metric', 'Value (INR)']],
    body: summaryRows,
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [30, 64, 175] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Invoice / Sales Entries', margin, y);
  y += 2;

  const invRows = params.rows.invoices.map((inv) => [
    inv.invoice_date,
    inv.invoice_number || '-',
    inv.customer_name || '-',
    (inv.total_amount || 0).toFixed(2),
    (inv.amount_paid || 0).toFixed(2),
    (inv.balance_due || 0).toFixed(2),
  ]);

  (autoTable as any)(doc, {
    startY: y + 2,
    head: [['Date', 'Invoice #', 'Customer', 'Total', 'Collected', 'Due']],
    body: invRows.length ? invRows : [['-', '-', '-', '0.00', '0.00', '0.00']],
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [22, 163, 74] },
    styles: { fontSize: 8 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  if (y > 240) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Service Entries', margin, y);
  y += 2;

  const serviceRows = params.rows.services.map((srv) => [
    srv.scheduled_date,
    srv.service_number || '-',
    srv.customer_name || '-',
    srv.status || '-',
    (srv.total_amount || 0).toFixed(2),
    srv.payment_status || '-',
  ]);

  (autoTable as any)(doc, {
    startY: y + 2,
    head: [['Date', 'Service #', 'Customer', 'Status', 'Amount', 'Payment'] ],
    body: serviceRows.length ? serviceRows : [['-', '-', '-', '-', '0.00', '-'] ],
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  if (y > 240) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Expense Entries', margin, y);
  y += 2;

  const expRows = params.rows.expenses.map((exp) => [
    exp.expense_date,
    exp.title,
    exp.category,
    exp.payment_method || '-',
    exp.amount.toFixed(2),
  ]);

  (autoTable as any)(doc, {
    startY: y + 2,
    head: [['Date', 'Title', 'Category', 'Payment', 'Amount']],
    body: expRows.length ? expRows : [['-', '-', '-', '-', '0.00']],
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [220, 38, 38] },
    styles: { fontSize: 8 },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, pageWidth - margin, 290, { align: 'right' });

  const fromSafe = params.from || 'na';
  const toSafe = params.to || 'na';
  doc.save(`DayBook_${params.periodLabel}_${fromSafe}_${toSafe}.pdf`);
}
