'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Loader2, IndianRupee, Download } from 'lucide-react';
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/invoice-pdf';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleSelect } from '@/components/ui/select';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { INVOICE_STATUS_LABELS } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { createBrowserClient } from '@/lib/supabase/client';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [recording, setRecording] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    Promise.all([
      supabase.from('invoices').select('*, customer:customers(*)').eq('id', id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([invRes, iRes, settings]) => {
      if (invRes.data) { setInvoice(invRes.data); setPaymentAmount(invRes.data.balance_due); }
      if (iRes.data) setItems(iRes.data);
      if (settings) setCompanySettings(settings);
      setLoading(false);
    });
  }, [id]);

  const handleRecordPayment = async () => {
    const balanceDue = invoice.balance_due ?? (invoice.total_amount - (invoice.amount_paid || 0));
    if (paymentAmount <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    if (paymentAmount > balanceDue) {
      toast.error(`Amount cannot exceed the due balance of ${formatCurrency(balanceDue)}`);
      return;
    }
    setRecording(true);
    try {
      const supabase = createBrowserClient();
      const newPaid = (invoice.amount_paid || 0) + paymentAmount;
      const newBalance = invoice.total_amount - newPaid;
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';
      const { error } = await supabase.from('invoices').update({
        amount_paid: newPaid,
        balance_due: Math.max(0, newBalance),
        status: newStatus,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      toast.success('Payment recorded!');
      setInvoice((inv: any) => ({ ...inv, amount_paid: newPaid, balance_due: Math.max(0, newBalance), status: newStatus }));
      setPaymentAmount(Math.max(0, newBalance));
      setShowPayment(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setRecording(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!invoice || !companySettings) return;
    const customer = invoice.customer as any;
    downloadInvoicePDF(
      { ...invoice, customer: { full_name: customer?.full_name, phone: customer?.phone, email: customer?.email, address_line1: customer?.address_line1, city: customer?.city, state: customer?.state, pincode: customer?.pincode, customer_code: customer?.customer_code } },
      items,
      companySettings
    );
  };

  const handlePrintInvoice = () => {
    if (!invoice || !companySettings) return;
    const customer = invoice.customer as any;
    printInvoicePDF(
      { ...invoice, customer: { full_name: customer?.full_name, phone: customer?.phone, email: customer?.email, address_line1: customer?.address_line1, city: customer?.city, state: customer?.state, pincode: customer?.pincode, customer_code: customer?.customer_code } },
      items,
      companySettings
    );
  };

  if (loading) return <Loading />;
  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Invoice not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/invoices')}>Back</Button>
      </div>
    );
  }

  const customer = invoice.customer as any;
  const paymentMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'card', label: 'Card' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/invoices')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
            <p className="text-muted-foreground">Invoice Date: {formatDate(invoice.invoice_date)}</p>
          </div>
          <Badge className={getStatusColor(invoice.status)}>{INVOICE_STATUS_LABELS[invoice.status as keyof typeof INVOICE_STATUS_LABELS] || invoice.status}</Badge>
        </div>
        <div className="flex gap-2">
          {invoice.status !== 'paid' && (
            <Button onClick={() => { setPaymentAmount(invoice.balance_due ?? (invoice.total_amount - (invoice.amount_paid || 0))); setShowPayment(true); }}><IndianRupee className="mr-2 h-4 w-4" /> Record Payment</Button>
          )}
          <Button variant="outline" onClick={handleDownloadPDF}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
          <Button variant="outline" onClick={handlePrintInvoice}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
          <CardContent>
            {customer && (
              <Link href={`/dashboard/customers/${customer.id}`} className="hover:underline">
                <p className="font-medium">{customer.full_name}</p>
                <p className="text-sm text-muted-foreground">{customer.phone} | {customer.address_line1}, {customer.city}</p>
              </Link>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Payment Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-bold">{formatCurrency(invoice.total_amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span><span className="font-medium text-green-600">{formatCurrency(invoice.amount_paid)}</span></div>
            <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Balance Due:</span><span className="font-bold text-red-600">{formatCurrency(invoice.balance_due)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="pb-2 font-medium">#</th><th className="pb-2 font-medium">Item</th><th className="pb-2 font-medium">Description</th><th className="pb-2 font-medium text-right">Qty</th><th className="pb-2 font-medium text-right">Price</th><th className="pb-2 font-medium text-right">Total</th></tr></thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{idx + 1}</td><td className="py-2">{item.item_name || '-'}</td><td className="py-2">{item.description}</td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right">{formatCurrency(item.unit_price)}</td><td className="py-2 text-right">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t mt-4 pt-4 space-y-1 text-right">
            <p className="text-sm">Subtotal: {formatCurrency(invoice.subtotal)}</p>
            <p className="text-sm">Tax ({invoice.tax_percent}%): {formatCurrency(invoice.tax_amount)}</p>
            {invoice.discount_amount > 0 && <p className="text-sm">Discount: -{formatCurrency(invoice.discount_amount)}</p>}
            <p className="text-lg font-bold border-t pt-2">Total: {formatCurrency(invoice.total_amount)}</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-800">Record Payment</DialogTitle>
            <DialogDescription>Record a payment for invoice {invoice.invoice_number}</DialogDescription>
          </DialogHeader>
          {(() => {
            const balanceDue = invoice.balance_due ?? (invoice.total_amount - (invoice.amount_paid || 0));
            return (
              <div className="space-y-4">
                <div className="rounded-md border p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Amount</span><span className="font-medium">{formatCurrency(invoice.total_amount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Already Paid</span><span className="font-medium text-green-600">{formatCurrency(invoice.amount_paid || 0)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-bold"><span className="text-red-600">Due Amount</span><span className="text-red-600">{formatCurrency(balanceDue)}</span></div>
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPaymentAmount(val > balanceDue ? balanceDue : val);
                    }}
                    min={0}
                    max={balanceDue}
                  />
                  {paymentAmount > balanceDue && <p className="text-xs text-red-500">Cannot exceed due amount of {formatCurrency(balanceDue)}</p>}
                </div>
                <div className="space-y-2"><Label>Payment Method</Label><SimpleSelect options={paymentMethodOptions} value={paymentMethod} onChange={setPaymentMethod} /></div>
                <div className="flex gap-3 pt-2">
                  <Button className="flex-1" onClick={handleRecordPayment} disabled={recording || paymentAmount <= 0 || paymentAmount > balanceDue}>{recording && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record {formatCurrency(paymentAmount)}</Button>
                  <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {invoice.notes && <Card><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{invoice.notes}</p></CardContent></Card>}
    </div>
  );
}
