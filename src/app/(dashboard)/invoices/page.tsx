'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { useInvoices } from '@/hooks/use-invoices';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { PAYMENT_STATUS_LABELS } from '@/lib/constants';

export default function InvoicesPage() {
  const { invoices, loading } = useInvoices();
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const filtered = invoices.filter((inv: any) => {
    const matchesSearch = !search ||
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      (inv.customer as any)?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesPayment = paymentFilter === 'all' || inv.payment_status === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Invoices</h1><p className="text-muted-foreground">{invoices.length} invoices</p></div>
        <Link href="/dashboard/invoices/new"><Button><Plus className="mr-2 h-4 w-4" /> New Invoice</Button></Link>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search invoices..." /></div>
        <select className="rounded-md border px-3 py-2 text-sm" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="all">All Payment Status</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No invoices found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv: any) => (
            <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{inv.invoice_number}</p>
                      <span className="text-sm text-muted-foreground">•</span>
                      <p className="text-sm">{(inv.customer as any)?.full_name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(inv.invoice_date)} | Total: {formatCurrency(inv.total_amount)} | Paid: {formatCurrency(inv.amount_paid)} | Due: {formatCurrency(inv.balance_due)}
                    </p>
                  </div>
                  <Badge className={getStatusColor(inv.payment_status)}>{PAYMENT_STATUS_LABELS[inv.payment_status as keyof typeof PAYMENT_STATUS_LABELS] || inv.payment_status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
