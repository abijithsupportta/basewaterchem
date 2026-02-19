'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Wrench, Clock, Calendar, CreditCard, IndianRupee,
  AlertCircle, ArrowRight, Phone, MapPin, FileCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { formatDate, formatCurrency, getStatusColor, cn } from '@/lib/utils';
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

    // Pending invoice payments
    const invQuery = supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'partial', 'overdue']);

    const [srvRes, pendRes, custRes, invRes] = await Promise.all([
      srvQuery,
      pendingQuery,
      custQuery,
      invQuery,
    ]);

    setServices(srvRes.data || []);
    setPendingServices(pendRes.data || []);
    setTotalCustomers(custRes.count || 0);
    setPendingPayments(invRes.count || 0);
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
                        <Badge className={getStatusColor(service.status)}>
                          {SERVICE_STATUS_LABELS[service.status as keyof typeof SERVICE_STATUS_LABELS] || service.status}
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
                      <Badge className={getStatusColor(service.status)}>
                        {SERVICE_STATUS_LABELS[service.status as keyof typeof SERVICE_STATUS_LABELS] || service.status}
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
