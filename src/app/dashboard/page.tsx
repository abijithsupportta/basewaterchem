'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Wrench, Clock, Calendar, CreditCard, IndianRupee,
  AlertCircle, ArrowRight, Phone, MapPin, FileCheck,
  Banknote, Smartphone, Building2, Receipt, CircleDollarSign,
  TrendingUp, CircleCheck, CircleDashed, CircleAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { formatDate, formatCurrency, getStatusColor, getEffectiveServiceStatus, cn } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

const TIME_CHIPS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
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

export default function DashboardPage() {
  const [timeFilter, setTimeFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [pendingServices, setPendingServices] = useState<any[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [invoices, setInvoices] = useState<any[]>([]);
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
    const todayStr = new Date().toISOString().split('T')[0];

    // Build services query - filtered by date range on scheduled_date
    let srvQuery = supabase
      .from('services')
      .select('*, customer:customers(id, full_name, phone, customer_code, city)')
      .order('scheduled_date', { ascending: false });

    if (dateRange.from) srvQuery = srvQuery.gte('scheduled_date', dateRange.from);
    if (dateRange.to) srvQuery = srvQuery.lte('scheduled_date', dateRange.to);

    // Pending services: past scheduled date, not completed/cancelled
    const pendingQuery = supabase
      .from('services')
      .select('*, customer:customers(id, full_name, phone, customer_code, city)')
      .in('status', ['scheduled', 'assigned', 'in_progress'])
      .lt('scheduled_date', todayStr)
      .order('scheduled_date', { ascending: true });

    // Total customers
    const custQuery = supabase
      .from('customers')
      .select('id', { count: 'exact', head: true });

    // Pending invoice payments count
    const invCountQuery = supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'partial', 'overdue']);

    // All invoices (for payment analytics, filtered by invoice_date)
    let invDataQuery = supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, amount_paid, balance_due, payment_method, payment_date, invoice_date, customer:customers(full_name)');

    if (dateRange.from) invDataQuery = invDataQuery.gte('invoice_date', dateRange.from);
    if (dateRange.to) invDataQuery = invDataQuery.lte('invoice_date', dateRange.to);

    const [srvRes, pendRes, custRes, invCountRes, invDataRes] = await Promise.all([
      srvQuery,
      pendingQuery,
      custQuery,
      invCountQuery,
      invDataQuery,
    ]);

    setServices(srvRes.data || []);
    setPendingServices(pendRes.data || []);
    setTotalCustomers(custRes.count || 0);
    setPendingPayments(invCountRes.count || 0);
    setInvoices(invDataRes.data || []);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute stats from filtered services
  const stats = useMemo(() => {
    const scheduled = services.filter((s: any) => s.status === 'scheduled' || s.status === 'assigned').length;
    const inProgress = services.filter((s: any) => s.status === 'in_progress').length;
    const completed = services.filter((s: any) => s.status === 'completed').length;
    const total = services.length;
    const revenue = services
      .filter((s: any) => s.status === 'completed' && s.total_amount)
      .reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);

    return { total, scheduled, inProgress, completed, revenue };
  }, [services]);

  // Payment analytics from invoices
  const paymentStats = useMemo(() => {
    const totalInvoiced = invoices.reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
    const totalCollected = invoices.reduce((s: number, i: any) => s + (i.amount_paid || 0), 0);
    const totalPending = invoices.reduce((s: number, i: any) => s + (i.balance_due || 0), 0);

    // By payment method
    const byMethod: Record<string, number> = { cash: 0, upi: 0, bank_transfer: 0, cheque: 0, card: 0 };
    invoices.forEach((i: any) => {
      if (i.amount_paid > 0 && i.payment_method) {
        const method = i.payment_method.toLowerCase();
        byMethod[method] = (byMethod[method] || 0) + (i.amount_paid || 0);
      }
    });
    // Unspecified method
    const methodSum = Object.values(byMethod).reduce((a, b) => a + b, 0);
    const unspecified = totalCollected - methodSum;

    // Invoice status counts
    const fullyPaid = invoices.filter((i: any) => i.status === 'paid').length;
    const partialPaid = invoices.filter((i: any) => i.status === 'partial').length;
    const unpaid = invoices.filter((i: any) => ['draft', 'sent', 'overdue'].includes(i.status)).length;

    // Service payment breakdown
    const srvPaid = services.filter((s: any) => s.payment_status === 'paid');
    const srvPartial = services.filter((s: any) => s.payment_status === 'partial');
    const srvPending = services.filter((s: any) => s.payment_status === 'pending');
    const srvPaidAmt = srvPaid.reduce((s: number, sv: any) => s + (sv.total_amount || 0), 0);
    const srvPartialAmt = srvPartial.reduce((s: number, sv: any) => s + (sv.total_amount || 0), 0);
    const srvPendingAmt = srvPending.reduce((s: number, sv: any) => s + (sv.total_amount || 0), 0);

    return {
      totalInvoiced, totalCollected, totalPending,
      byMethod, unspecified,
      fullyPaid, partialPaid, unpaid,
      srvPaid: srvPaid.length, srvPartial: srvPartial.length, srvPending: srvPending.length,
      srvPaidAmt, srvPartialAmt, srvPendingAmt,
    };
  }, [invoices, services]);

  const statCards = [
    { title: 'Total Services', value: stats.total, icon: Wrench, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Scheduled', value: stats.scheduled, icon: FileCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { title: 'Completed', value: stats.completed, icon: Calendar, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Pending (Overdue)', value: pendingServices.length, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Total Customers', value: totalCustomers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Revenue', value: formatCurrency(stats.revenue), icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50', isFormatted: true },
    { title: 'Pending Payments', value: pendingPayments, icon: CreditCard, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your service operations</p>
      </div>

      {/* Time Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {TIME_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setTimeFilter(chip.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              timeFilter === chip.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
            )}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-lg p-3 ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
                  <p className="text-xl font-bold">{loading ? '...' : card.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── Payment Collection Section ─── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CircleDollarSign className="h-5 w-5 text-emerald-600" />
          Payment Collection
        </h2>

        {/* Collection Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="rounded-lg p-2 bg-emerald-100"><TrendingUp className="h-4 w-4 text-emerald-700" /></div>
                <p className="text-xs font-medium text-muted-foreground">Total Invoiced</p>
              </div>
              <p className="text-2xl font-bold text-emerald-800">{loading ? '...' : formatCurrency(paymentStats.totalInvoiced)}</p>
              <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoices</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="rounded-lg p-2 bg-green-100"><IndianRupee className="h-4 w-4 text-green-700" /></div>
                <p className="text-xs font-medium text-muted-foreground">Total Collected</p>
              </div>
              <p className="text-2xl font-bold text-green-700">{loading ? '...' : formatCurrency(paymentStats.totalCollected)}</p>
              <p className="text-xs text-muted-foreground mt-1">{paymentStats.fullyPaid} fully paid, {paymentStats.partialPaid} partial</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="rounded-lg p-2 bg-red-100"><AlertCircle className="h-4 w-4 text-red-600" /></div>
                <p className="text-xs font-medium text-muted-foreground">Pending to Collect</p>
              </div>
              <p className="text-2xl font-bold text-red-600">{loading ? '...' : formatCurrency(paymentStats.totalPending)}</p>
              <p className="text-xs text-muted-foreground mt-1">{paymentStats.unpaid} unpaid, {paymentStats.partialPaid} partial</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Method Breakdown + Invoice/Service Status */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* By Payment Method */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                Collection by Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Loading /> : (
                <div className="space-y-3">
                  {[
                    { key: 'cash', label: 'Cash', icon: Banknote, color: 'bg-green-500', textColor: 'text-green-700' },
                    { key: 'upi', label: 'UPI', icon: Smartphone, color: 'bg-purple-500', textColor: 'text-purple-700' },
                    { key: 'bank_transfer', label: 'Bank Transfer', icon: Building2, color: 'bg-blue-500', textColor: 'text-blue-700' },
                    { key: 'cheque', label: 'Cheque', icon: Receipt, color: 'bg-amber-500', textColor: 'text-amber-700' },
                    { key: 'card', label: 'Card', icon: CreditCard, color: 'bg-indigo-500', textColor: 'text-indigo-700' },
                  ].map(({ key, label, icon: Icon, color, textColor }) => {
                    const amt = paymentStats.byMethod[key] || 0;
                    const pct = paymentStats.totalCollected > 0 ? (amt / paymentStats.totalCollected) * 100 : 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${textColor}`} />
                            {label}
                          </span>
                          <span className="font-semibold">{formatCurrency(amt)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {paymentStats.unspecified > 0 && (
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">Other / Unspecified</span>
                      <span className="font-semibold">{formatCurrency(paymentStats.unspecified)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm border-t pt-2 font-bold">
                    <span>Total Collected</span>
                    <span className="text-green-700">{formatCurrency(paymentStats.totalCollected)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice & Service Payment Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Invoice breakdown */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">INVOICES</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-green-50/50">
                    <div className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-green-600" /><span className="text-sm">Fully Paid</span></div>
                    <span className="text-sm font-bold text-green-700">{paymentStats.fullyPaid}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-amber-50/50">
                    <div className="flex items-center gap-2"><CircleDashed className="h-4 w-4 text-amber-600" /><span className="text-sm">Partially Paid</span></div>
                    <span className="text-sm font-bold text-amber-700">{paymentStats.partialPaid}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-red-50/50">
                    <div className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-red-600" /><span className="text-sm">Unpaid / Due</span></div>
                    <span className="text-sm font-bold text-red-600">{paymentStats.unpaid}</span>
                  </div>
                </div>
              </div>
              {/* Service breakdown */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">SERVICES</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-green-50/50">
                    <div className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-green-600" /><span className="text-sm">Paid ({paymentStats.srvPaid})</span></div>
                    <span className="text-sm font-bold text-green-700">{formatCurrency(paymentStats.srvPaidAmt)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-amber-50/50">
                    <div className="flex items-center gap-2"><CircleDashed className="h-4 w-4 text-amber-600" /><span className="text-sm">Partial ({paymentStats.srvPartial})</span></div>
                    <span className="text-sm font-bold text-amber-700">{formatCurrency(paymentStats.srvPartialAmt)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-red-50/50">
                    <div className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-red-600" /><span className="text-sm">Pending ({paymentStats.srvPending})</span></div>
                    <span className="text-sm font-bold text-red-600">{formatCurrency(paymentStats.srvPendingAmt)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pending / Overdue Services */}
      {pendingServices.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Pending Services ({pendingServices.length})
            </CardTitle>
            <Link href="/dashboard/services?status=scheduled">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              These services are past their scheduled date but not yet completed or cancelled. They need to be completed, cancelled, or rescheduled.
            </p>
            <div className="space-y-2">
              {pendingServices.slice(0, 10).map((service: any) => {
                const customer = service.customer as any;
                return (
                  <Link
                    key={service.id}
                    href={`/dashboard/services/${service.id}`}
                    className="block rounded-lg border border-red-100 bg-red-50/50 p-3 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{customer?.full_name}</span>
                          <Badge variant="outline" className="text-xs">{SERVICE_TYPE_LABELS[service.service_type as keyof typeof SERVICE_TYPE_LABELS]}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 text-red-600">
                            <Calendar className="h-3 w-3" />
                            {formatDate(service.scheduled_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer?.phone}
                          </span>
                          {customer?.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {customer.city}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(getEffectiveServiceStatus(service.status, service.scheduled_date))}>
                          {SERVICE_STATUS_LABELS[getEffectiveServiceStatus(service.status, service.scheduled_date) as keyof typeof SERVICE_STATUS_LABELS] || service.status}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">{service.service_number}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {pendingServices.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  + {pendingServices.length - 10} more pending services
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services List for Selected Period */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            Services ({services.length})
          </CardTitle>
          <Link href="/dashboard/services">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading />
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No services found for this period</p>
          ) : (
            <div className="space-y-2">
              {services.slice(0, 20).map((service: any) => {
                const customer = service.customer as any;
                return (
                  <Link
                    key={service.id}
                    href={`/dashboard/services/${service.id}`}
                    className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{customer?.full_name}</span>
                          <Badge variant="outline" className="text-xs">{SERVICE_TYPE_LABELS[service.service_type as keyof typeof SERVICE_TYPE_LABELS]}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(service.scheduled_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer?.phone}
                          </span>
                          {customer?.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {customer.city}
                            </span>
                          )}
                          {service.service_number && (
                            <span className="text-muted-foreground">{service.service_number}</span>
                          )}
                        </div>
                      </div>
                      <Badge className={getStatusColor(getEffectiveServiceStatus(service.status, service.scheduled_date))}>
                        {SERVICE_STATUS_LABELS[getEffectiveServiceStatus(service.status, service.scheduled_date) as keyof typeof SERVICE_STATUS_LABELS] || service.status}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
              {services.length > 20 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Showing 20 of {services.length} services
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
