'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, ArrowRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loading } from '@/components/ui/loading';
import { formatCurrency, formatDate, getEffectiveServiceStatus, getStatusColor } from '@/lib/utils';
import { SERVICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';
import { downloadDayBookPDF } from '@/lib/daybook-pdf';

const TIME_CHIPS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

function getDateRange(period: string): { from?: string; to?: string } {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  switch (period) {
    case 'today':
      return { from: todayStr, to: todayStr };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      return { from: yStr, to: yStr };
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
    }
    default:
      return {};
  }
}

export default function DayBookPage() {
  const [timeFilter, setTimeFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    if (timeFilter === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    return getDateRange(timeFilter);
  }, [timeFilter, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createBrowserClient();

    let invQuery = supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, amount_paid, balance_due, payment_method, payment_date, invoice_date, customer:customers(full_name)')
      .order('invoice_date', { ascending: false });

    let srvQuery = supabase
      .from('services')
      .select('id, service_number, status, payment_status, total_amount, scheduled_date, completed_date, customer:customers(full_name)')
      .order('scheduled_date', { ascending: false });

    let expQuery = supabase
      .from('expenses')
      .select('id, expense_date, title, category, amount, payment_method, description')
      .order('expense_date', { ascending: false });

    if (dateRange.from) {
      invQuery = invQuery.gte('invoice_date', dateRange.from);
      srvQuery = srvQuery.gte('scheduled_date', dateRange.from);
      expQuery = expQuery.gte('expense_date', dateRange.from);
    }
    if (dateRange.to) {
      invQuery = invQuery.lte('invoice_date', dateRange.to);
      srvQuery = srvQuery.lte('scheduled_date', dateRange.to);
      expQuery = expQuery.lte('expense_date', dateRange.to);
    }

    const [invRes, srvRes, expRes] = await Promise.all([invQuery, srvQuery, expQuery]);
    setInvoices(invRes.data || []);
    setServices(srvRes.data || []);
    setExpenses(expRes.data || []);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = useMemo(() => {
    const sales = invoices.reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0);
    const collected = invoices.reduce((sum: number, i: any) => sum + (i.amount_paid || 0), 0);
    const dues = invoices.reduce((sum: number, i: any) => sum + (i.balance_due || 0), 0);
    const serviceRevenue = services
      .filter((s: any) => s.status === 'completed')
      .reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
    const expensesTotal = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const profit = collected + serviceRevenue - expensesTotal;

    return {
      sales: sales + serviceRevenue,
      serviceRevenue,
      expensesTotal,
      collected,
      dues,
      profit,
    };
  }, [invoices, services, expenses]);

  const downloadStatement = () => {
    downloadDayBookPDF({
      periodLabel: timeFilter,
      from: dateRange.from,
      to: dateRange.to,
      summary: {
        sales: totals.sales,
        services: services.length,
        revenue: totals.serviceRevenue,
        expenses: totals.expensesTotal,
        dues: totals.dues,
        collected: totals.collected,
        profit: totals.profit,
      },
      rows: {
        invoices: invoices.map((i: any) => ({
          invoice_number: i.invoice_number,
          invoice_date: i.invoice_date,
          customer_name: i.customer?.full_name,
          total_amount: i.total_amount,
          amount_paid: i.amount_paid,
          balance_due: i.balance_due,
        })),
        services: services.map((s: any) => ({
          service_number: s.service_number,
          scheduled_date: s.scheduled_date,
          customer_name: s.customer?.full_name,
          status: s.status,
          total_amount: s.total_amount,
          payment_status: s.payment_status,
        })),
        expenses: expenses.map((e: any) => ({
          expense_date: e.expense_date,
          title: e.title,
          category: e.category,
          amount: e.amount,
          payment_method: e.payment_method,
        })),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold">Day Book</h1>
            <p className="text-muted-foreground">Sales, services, and expenses in one place</p>
          </div>
        </div>
        <Button onClick={downloadStatement}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TIME_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setTimeFilter(chip.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${timeFilter === chip.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'}`}
          >
            {chip.label}
          </button>
        ))}
        {timeFilter === 'custom' && (
          <DateRangePicker
            from={customFrom}
            to={customTo}
            onChange={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Sales</p><p className="font-bold">{formatCurrency(totals.sales)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Services</p><p className="font-bold">{services.length}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Expenses</p><p className="font-bold text-red-600">{formatCurrency(totals.expensesTotal)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Dues</p><p className="font-bold text-amber-600">{formatCurrency(totals.dues)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Profit</p><p className={`font-bold ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(totals.profit)}</p></div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Reference</th>
                    <th className="text-left py-3 px-4">Customer / Description</th>
                    <th className="text-right py-3 px-4">Amount</th>
                    <th className="text-right py-3 px-4">Dues</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...invoices.map((inv: any) => ({
                    date: inv.invoice_date,
                    type: 'Sales',
                    reference: inv.invoice_number || '-',
                    description: inv.customer?.full_name || '-',
                    amount: inv.total_amount || 0,
                    dues: inv.balance_due || 0,
                    status: inv.status,
                    key: `inv-${inv.id}`,
                  })),
                  ...services.map((srv: any) => ({
                    date: srv.scheduled_date,
                    type: 'Service',
                    reference: srv.service_number || '-',
                    description: srv.customer?.full_name || '-',
                    amount: srv.total_amount || 0,
                    dues: srv.payment_status === 'pending' || srv.payment_status === 'partial' ? srv.total_amount || 0 : 0,
                    status: srv.status,
                    key: `srv-${srv.id}`,
                  })),
                  ...expenses.map((exp: any) => ({
                    date: exp.expense_date,
                    type: 'Expense',
                    reference: exp.category,
                    description: exp.title,
                    amount: -(exp.amount || 0),
                    dues: 0,
                    status: exp.payment_method || '-',
                    key: `exp-${exp.id}`,
                  }))]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((entry: any) => (
                      <tr key={entry.key} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{formatDate(entry.date)}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={entry.type === 'Expense' ? 'border-red-500 text-red-600' : entry.type === 'Service' ? 'border-blue-500 text-blue-600' : 'border-green-500 text-green-600'}>
                            {entry.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{entry.reference}</td>
                        <td className="py-3 px-4">{entry.description}</td>
                        <td className="py-3 px-4 text-right font-medium">
                          <span className={entry.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(Math.abs(entry.amount))}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-amber-600">
                          {entry.dues > 0 ? formatCurrency(entry.dues) : '-'}
                        </td>
                        <td className="py-3 px-4"><span className="text-xs text-muted-foreground">{entry.status}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {invoices.length === 0 && services.length === 0 && expenses.length === 0 && (
                <p className="text-sm text-muted-foreground py-12 text-center">No entries found for this period</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
