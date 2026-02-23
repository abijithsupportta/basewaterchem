'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, IndianRupee, Download, Pencil, Building2, Trash2 } from 'lucide-react';
import { downloadInvoicePDF } from '@/lib/invoice-pdf';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleSelect } from '@/components/ui/select';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { INVOICE_STATUS_LABELS } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { createBrowserClient } from '@/lib/supabase/client';
import { useUserRole } from '@/lib/use-user-role';
import { isSuperadmin } from '@/lib/authz';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [recording, setRecording] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);
  const userRole = useUserRole();

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    Promise.all([
      supabase.from('invoices').select('*, customer:customers(*), branch:branches(id,branch_name,branch_code)').eq('id', id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
      supabase.from('invoice_payments').select('*').eq('invoice_id', id).order('paid_at', { ascending: false }),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([invRes, iRes, payRes, settings]) => {
      if (invRes.data) { setInvoice(invRes.data); setPaymentAmount(invRes.data.balance_due); }
      if (iRes.data) setItems(iRes.data);
      if (payRes.data) setPaymentHistory(payRes.data);
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
      let createdByStaffId: string | null = null;
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data: staff } = await supabase
          .from('staff')
          .select('id')
          .eq('auth_user_id', authData.user.id)
          .maybeSingle();
        createdByStaffId = staff?.id ?? null;
      }

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

      const { data: paymentRow, error: paymentError } = await supabase
        .from('invoice_payments')
        .insert({
          invoice_id: id,
          amount: paymentAmount,
          payment_method: paymentMethod,
          payment_reference: paymentReference || null,
          created_by: createdByStaffId,
        })
        .select()
        .single();
      if (paymentError) throw paymentError;

      toast.success('Payment recorded!');
      setInvoice((inv: any) => ({ ...inv, amount_paid: newPaid, balance_due: Math.max(0, newBalance), status: newStatus }));
      if (paymentRow) setPaymentHistory((prev) => [paymentRow, ...prev]);
      setPaymentAmount(Math.max(0, newBalance));
      setPaymentReference('');
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

  const handleDeleteInvoice = async () => {
    if (!isSuperadmin(userRole as any)) {
      toast.error('Only superadmin can delete invoices');
      return;
    }
    const confirmed = window.confirm('Delete this invoice? This action cannot be undone.');
    if (!confirmed) return;
    setDeleting(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast.success('Invoice deleted');
      router.push('/dashboard/invoices');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
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
          <Link href={`/dashboard/invoices/${id}/edit`}><Button variant="outline"><Pencil className="mr-2 h-4 w-4" /> Edit</Button></Link>
          {isSuperadmin(userRole as any) && (
            <Button variant="destructive" onClick={handleDeleteInvoice} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          )}
          {invoice.status !== 'paid' && (
            <Button onClick={() => { setPaymentAmount(invoice.balance_due ?? (invoice.total_amount - (invoice.amount_paid || 0))); setShowPayment(true); }}><IndianRupee className="mr-2 h-4 w-4" /> Record Payment</Button>
          )}
          <Button variant="outline" onClick={handleDownloadPDF}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Invoice Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice #</span><span className="font-medium">{invoice.invoice_number}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{formatDate(invoice.invoice_date)}</span></div>
            {invoice.due_date && <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span>{formatDate(invoice.due_date)}</span></div>}
            <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Status</span><Badge className={getStatusColor(invoice.status)}>{INVOICE_STATUS_LABELS[invoice.status as keyof typeof INVOICE_STATUS_LABELS] || invoice.status}</Badge></div>
          </CardContent>
        </Card>
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
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Branch</CardTitle></CardHeader>
          <CardContent>
            {invoice.branch ? (
              <div className="space-y-1">
                <p className="font-medium">{invoice.branch.branch_name}</p>
                <p className="text-sm text-muted-foreground">{invoice.branch.branch_code}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No branch assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="pb-2 pt-2 px-2 font-medium">#</th>
                  <th className="pb-2 pt-2 px-2 font-medium">Item</th>
                  <th className="pb-2 pt-2 px-2 font-medium">Description</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Qty</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Price</th>
                  <th className="pb-2 pt-2 px-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">No line items found</td>
                  </tr>
                )}
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2 px-2">{idx + 1}</td>
                    <td className="py-2 px-2 font-medium">{item.item_name || '-'}</td>
                    <td className="py-2 px-2 text-muted-foreground">{item.description || '-'}</td>
                    <td className="py-2 px-2 text-right">{item.quantity}</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t mt-4 pt-4 space-y-1 text-right">
            <p className="text-sm">Subtotal: {formatCurrency(invoice.subtotal)}</p>
            <p className="text-sm">Tax ({invoice.tax_percent}%): {formatCurrency(invoice.tax_amount)}</p>
            {invoice.discount_amount > 0 && <p className="text-sm">Discount: -{formatCurrency(invoice.discount_amount)}</p>}
            <p className="text-lg font-bold border-t pt-2">Total: {formatCurrency(invoice.total_amount)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
        <CardContent>
          {paymentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="pb-2 pt-2 px-2 font-medium">Date</th>
                    <th className="pb-2 pt-2 px-2 font-medium">Method</th>
                    <th className="pb-2 pt-2 px-2 font-medium">Reference</th>
                    <th className="pb-2 pt-2 px-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 px-2 text-muted-foreground">{formatDate(p.paid_at)}</td>
                      <td className="py-2 px-2">{(p.payment_method || '').toUpperCase()}</td>
                      <td className="py-2 px-2 text-muted-foreground">{p.payment_reference || '-'}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                  <Label>Amount (Rs)</Label>
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
                <div className="space-y-2">
                  <Label>Reference (Optional)</Label>
                  <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Txn ID / UTR / Cheque" />
                </div>
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
