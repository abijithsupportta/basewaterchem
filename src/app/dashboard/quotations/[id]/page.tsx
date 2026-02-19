'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Check, X, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase/client';

const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected', expired: 'Expired' };

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    Promise.all([
      supabase.from('quotations').select('*, customer:customers(*)').eq('id', id).single(),
      supabase.from('quotation_items').select('*').eq('quotation_id', id).order('sort_order'),
    ]).then(([qRes, iRes]) => {
      if (qRes.data) setQuotation(qRes.data);
      if (iRes.data) setItems(iRes.data);
      setLoading(false);
    });
  }, [id]);

  const updateStatus = async (status: string) => {
    const supabase = createBrowserClient();
    const { error } = await supabase.from('quotations').update({ status }).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success(`Quotation ${status}!`);
    setQuotation((q: any) => ({ ...q, status }));
  };

  if (loading) return <Loading />;
  if (!quotation) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Quotation not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/quotations')}>Back</Button>
      </div>
    );
  }

  const customer = quotation.customer as any;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{quotation.quotation_number}</h1>
            <p className="text-muted-foreground">Created: {formatDate(quotation.created_at)}</p>
          </div>
          <Badge className={getStatusColor(quotation.status)}>{STATUS_LABELS[quotation.status]}</Badge>
        </div>
        <div className="flex gap-2">
          {quotation.status === 'draft' && <Button variant="outline" onClick={() => updateStatus('sent')}><Send className="mr-2 h-4 w-4" /> Mark Sent</Button>}
          {quotation.status === 'sent' && (
            <>
              <Button onClick={() => updateStatus('accepted')}><Check className="mr-2 h-4 w-4" /> Accept</Button>
              <Button variant="destructive" onClick={() => updateStatus('rejected')}><X className="mr-2 h-4 w-4" /> Reject</Button>
            </>
          )}
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        </div>
      </div>

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
        <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium text-right">Qty</th>
                <th className="pb-2 font-medium text-right">Unit Price</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{idx + 1}</td>
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-2 text-right">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t mt-4 pt-4 space-y-1 text-right">
            <p className="text-sm">Subtotal: <span className="font-medium">{formatCurrency(quotation.subtotal)}</span></p>
            <p className="text-sm">Tax ({quotation.tax_percent}%): <span className="font-medium">{formatCurrency(quotation.tax_amount)}</span></p>
            {quotation.discount_amount > 0 && <p className="text-sm">Discount: <span className="font-medium">-{formatCurrency(quotation.discount_amount)}</span></p>}
            <p className="text-lg font-bold border-t pt-2">Total: {formatCurrency(quotation.total_amount)}</p>
          </div>
        </CardContent>
      </Card>

      {quotation.notes && (
        <Card><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{quotation.notes}</p></CardContent></Card>
      )}
    </div>
  );
}
