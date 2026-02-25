'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Wrench, Clock, Calendar, CreditCard, IndianRupee,
  AlertCircle, ArrowRight, Phone, MapPin, FileCheck,
  Banknote, Smartphone, Building2, Receipt, CircleDollarSign,
  TrendingUp, CircleCheck, CircleDashed, CircleAlert, Wallet, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { formatDate, formatCurrency, getStatusColor, getEffectiveServiceStatus, cn } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';
import { downloadDayBookPDF } from '@/lib/daybook-pdf';
import { canAccessDashboard } from '@/lib/authz';
import { useBranchSelection } from '@/hooks/use-branch-selection';
import { useUserRoleState } from '@/lib/use-user-role';
import type { InventoryProduct } from '@/types/inventory';
import { readStaleCache, writeStaleCache } from '@/lib/stale-cache';
import { useDashboardSessionOptional } from '@/providers/dashboard-session-provider';

type DashboardCachePayload = {
  services: any[];
  pendingServices: any[];
  totalCustomers: number;
  pendingPayments: number;
  invoices: any[];
  expenses: any[];
  inventoryProducts: InventoryProduct[];
  staffId: string | null;
};

const DASHBOARD_CACHE_TTL_MS = 600000;
const WHATSAPP_COST_PER_MESSAGE = 0.8;

const MESSAGE_TIME_CHIPS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

function DashboardContentSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="mt-2 h-4 w-72 rounded bg-muted" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-8 w-20 rounded-full bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="rounded-xl border p-5">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="mt-3 h-7 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-5 space-y-3">
        <div className="h-5 w-40 rounded bg-muted" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 w-full rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

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
  const router = useRouter();
  const dashboardSession = useDashboardSessionOptional();
  const { selectedBranchId } = useBranchSelection();
  const { role: resolvedUserRole, loading: roleLoading } = useUserRoleState();
  const userRole = resolvedUserRole ?? 'staff';
  const [timeFilter, setTimeFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [pendingServices, setPendingServices] = useState<any[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [messageFilter, setMessageFilter] = useState('all');
  const [messageCustomFrom, setMessageCustomFrom] = useState('');
  const [messageCustomTo, setMessageCustomTo] = useState('');
  const [whatsAppMessageCount, setWhatsAppMessageCount] = useState(0);
  const [whatsAppMessageCost, setWhatsAppMessageCost] = useState(0);
  const [messageStatsLoading, setMessageStatsLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  // Redirect staff away from dashboard
  useEffect(() => {
    if (roleLoading) return;
    if (userRole && !canAccessDashboard(userRole)) {
      router.replace('/dashboard/services');
    }
  }, [router, userRole, roleLoading]);

  const dateRange = useMemo(() => {
    if (timeFilter === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    return getDateRange(timeFilter);
  }, [timeFilter, customFrom, customTo]);

  const dashboardCacheKey = useMemo(
    () =>
      `dashboard:summary:v1:${userRole}:${selectedBranchId}:${dateRange.from ?? 'none'}:${dateRange.to ?? 'none'}`,
    [userRole, selectedBranchId, dateRange.from, dateRange.to]
  );

  const applyDashboardData = useCallback((payload: DashboardCachePayload) => {
    setServices(payload.services ?? []);
    setPendingServices(payload.pendingServices ?? []);
    setTotalCustomers(payload.totalCustomers ?? 0);
    setPendingPayments(payload.pendingPayments ?? 0);
    setInvoices(payload.invoices ?? []);
    setExpenses(payload.expenses ?? []);
    setInventoryProducts(payload.inventoryProducts ?? []);
    setStaffId(payload.staffId ?? null);
  }, []);

  const fetchData = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
    }

    const supabase = createBrowserClient();
    const todayStr = new Date().toISOString().split('T')[0];

    const currentStaffId = dashboardSession?.staffId ?? null;
    setStaffId(currentStaffId);

    if (userRole === 'technician') {
      let techSrvQuery = supabase
        .from('services')
        .select('*, customer:customers(id, full_name, phone, customer_code, city)')
        .eq('scheduled_date', todayStr)
        .order('scheduled_date', { ascending: true });

      if (currentStaffId) {
        techSrvQuery = techSrvQuery.eq('assigned_technician_id', currentStaffId);
      }

      const [srvRes, stockRes] = await Promise.all([
        techSrvQuery,
        supabase
          .from('inventory_products')
          .select('id, name, stock_quantity, min_stock_level, unit_of_measure, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      setServices(srvRes.data || []);
      setPendingServices([]);
      setTotalCustomers(0);
      setPendingPayments(0);
      setInvoices([]);
      setExpenses([]);
      setInventoryProducts((stockRes.data as InventoryProduct[]) || []);
      const nextPayload: DashboardCachePayload = {
        services: srvRes.data || [],
        pendingServices: [],
        totalCustomers: 0,
        pendingPayments: 0,
        invoices: [],
        expenses: [],
        inventoryProducts: (stockRes.data as InventoryProduct[]) || [],
        staffId: currentStaffId,
      };
      writeStaleCache<DashboardCachePayload>(dashboardCacheKey, nextPayload);

      if (!background) {
        setLoading(false);
      }
      return;
    }

    // Build services query by branch; date filtering is applied client-side using
    // effective service date (completed_date fallback scheduled_date)
    let srvQuery = supabase
      .from('services')
      .select('*, customer:customers(id, full_name, phone, customer_code, city)')
      .order('scheduled_date', { ascending: false });

    if (selectedBranchId && selectedBranchId !== 'all') srvQuery = srvQuery.eq('branch_id', selectedBranchId);

    // Pending services: past scheduled date, not completed/cancelled
    let pendingQuery = supabase
      .from('services')
      .select('*, customer:customers(id, full_name, phone, customer_code, city)')
      .in('status', ['scheduled', 'assigned', 'in_progress'])
      .lt('scheduled_date', todayStr)
      .order('scheduled_date', { ascending: true });

    if (selectedBranchId && selectedBranchId !== 'all') pendingQuery = pendingQuery.eq('branch_id', selectedBranchId);

    // Total customers
    let custQuery = supabase
      .from('customers')
      .select('id', { count: 'exact', head: true });

    if (selectedBranchId && selectedBranchId !== 'all') custQuery = custQuery.eq('branch_id', selectedBranchId);

    // Pending invoice payments count
    let invCountQuery = supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'partial', 'overdue']);

    if (selectedBranchId && selectedBranchId !== 'all') invCountQuery = invCountQuery.eq('branch_id', selectedBranchId);

    // All invoices (for payment analytics, filtered by invoice_date AND branch)
    let invDataQuery = supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, amount_paid, balance_due, payment_method, payment_date, invoice_date, customer:customers(full_name)');

    let expenseQuery = supabase
      .from('expenses')
      .select('id, expense_date, title, category, amount, payment_method, description')
      .order('expense_date', { ascending: false });

    if (selectedBranchId && selectedBranchId !== 'all') {
      invDataQuery = invDataQuery.eq('branch_id', selectedBranchId);
      expenseQuery = expenseQuery.eq('branch_id', selectedBranchId);
    }

    if (dateRange.from) invDataQuery = invDataQuery.gte('invoice_date', dateRange.from);
    if (dateRange.to) invDataQuery = invDataQuery.lte('invoice_date', dateRange.to);
    if (dateRange.from) expenseQuery = expenseQuery.gte('expense_date', dateRange.from);
    if (dateRange.to) expenseQuery = expenseQuery.lte('expense_date', dateRange.to);

    const [srvRes, pendRes, custRes, invCountRes, invDataRes, expRes] = await Promise.all([
      srvQuery,
      pendingQuery,
      custQuery,
      invCountQuery,
      invDataQuery,
      expenseQuery,
    ]);

    const allServices = srvRes.data || [];
    const servicesInRange = allServices.filter((service: any) => {
      const dateValue = (service.completed_date || service.scheduled_date || '').toString().slice(0, 10);
      if (!dateValue) return false;
      if (dateRange.from && dateValue < dateRange.from) return false;
      if (dateRange.to && dateValue > dateRange.to) return false;
      return true;
    });

    setServices(servicesInRange);
    setPendingServices(pendRes.data || []);
    setTotalCustomers(custRes.count || 0);
    setPendingPayments(invCountRes.count || 0);
    setInvoices(invDataRes.data || []);
    setExpenses(expRes.data || []);
    const nextPayload: DashboardCachePayload = {
      services: servicesInRange,
      pendingServices: pendRes.data || [],
      totalCustomers: custRes.count || 0,
      pendingPayments: invCountRes.count || 0,
      invoices: invDataRes.data || [],
      expenses: expRes.data || [],
      inventoryProducts: [],
      staffId: currentStaffId,
    };
    writeStaleCache<DashboardCachePayload>(dashboardCacheKey, nextPayload);

    if (!background) {
      setLoading(false);
    }
  }, [dateRange, selectedBranchId, userRole, dashboardSession?.staffId, dashboardCacheKey]);

  useEffect(() => {
    if (roleLoading) return;

    const cached = readStaleCache<DashboardCachePayload>(dashboardCacheKey, DASHBOARD_CACHE_TTL_MS);
    if (cached) {
      applyDashboardData(cached);
      setLoading(false);
    }

    void fetchData(Boolean(cached));
  }, [fetchData, applyDashboardData, dashboardCacheKey, roleLoading]);

  useEffect(() => {
    if (roleLoading) return;
    if (userRole === 'technician') {
      setWhatsAppMessageCount(0);
      setWhatsAppMessageCost(0);
      setMessageStatsLoading(false);
      return;
    }

    const fetchMessageStats = async () => {
      setMessageStatsLoading(true);
      const supabase = createBrowserClient();

      let scheduledQuery = supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('whatsapp_scheduled_status', 'sent');

      let reminderQuery = supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('whatsapp_reminder_status', 'sent');

      if (selectedBranchId && selectedBranchId !== 'all') {
        scheduledQuery = scheduledQuery.eq('branch_id', selectedBranchId);
        reminderQuery = reminderQuery.eq('branch_id', selectedBranchId);
      }

      if (messageFilter === 'month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
        scheduledQuery = scheduledQuery.gte('whatsapp_scheduled_sent_at', start).lte('whatsapp_scheduled_sent_at', end);
        reminderQuery = reminderQuery.gte('whatsapp_reminder_sent_at', start).lte('whatsapp_reminder_sent_at', end);
      } else if (messageFilter === 'custom') {
        if (messageCustomFrom) {
          const start = new Date(`${messageCustomFrom}T00:00:00.000Z`).toISOString();
          scheduledQuery = scheduledQuery.gte('whatsapp_scheduled_sent_at', start);
          reminderQuery = reminderQuery.gte('whatsapp_reminder_sent_at', start);
        }
        if (messageCustomTo) {
          const end = new Date(`${messageCustomTo}T23:59:59.999Z`).toISOString();
          scheduledQuery = scheduledQuery.lte('whatsapp_scheduled_sent_at', end);
          reminderQuery = reminderQuery.lte('whatsapp_reminder_sent_at', end);
        }
      }

      const [scheduledRes, reminderRes] = await Promise.all([scheduledQuery, reminderQuery]);
      const totalMessages = (scheduledRes.count || 0) + (reminderRes.count || 0);
      setWhatsAppMessageCount(totalMessages);
      setWhatsAppMessageCost(totalMessages * WHATSAPP_COST_PER_MESSAGE);
      setMessageStatsLoading(false);
    };

    void fetchMessageStats();
  }, [messageFilter, messageCustomFrom, messageCustomTo, selectedBranchId, userRole, roleLoading]);

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

  const expenseStats = useMemo(() => {
    const total = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
    return { total, count: expenses.length };
  }, [expenses]);

  const dayBook = useMemo(() => {
    const sales = paymentStats.totalInvoiced + stats.revenue;
    const servicesCount = stats.total;
    const revenue = stats.revenue;
    const expensesTotal = expenseStats.total;
    const dues = paymentStats.totalPending;
    const collected = paymentStats.totalCollected;
    const profit = collected + revenue - expensesTotal;

    return {
      sales,
      services: servicesCount,
      revenue,
      expenses: expensesTotal,
      dues,
      collected,
      profit,
    };
  }, [paymentStats, stats, expenseStats]);

  const downloadStatement = () => {
    downloadDayBookPDF({
      periodLabel: timeFilter,
      from: dateRange.from,
      to: dateRange.to,
      summary: dayBook,
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

  const technicianDues = useMemo(() => {
    return services.reduce((sum: number, s: any) => {
      if (s.payment_status === 'paid') return sum;
      const total = s.total_amount || 0;
      const paid = s.amount_paid || 0;
      return sum + Math.max(0, total - paid);
    }, 0);
  }, [services]);

  const lowStockItems = useMemo(() => {
    return inventoryProducts.filter((p) =>
      typeof p.min_stock_level === 'number' && p.stock_quantity <= p.min_stock_level
    );
  }, [inventoryProducts]);

  const hasPrimaryData =
    services.length > 0 ||
    pendingServices.length > 0 ||
    invoices.length > 0 ||
    expenses.length > 0 ||
    totalCustomers > 0 ||
    pendingPayments > 0;

  if (!roleLoading && userRole !== 'technician' && loading && !hasPrimaryData) {
    return <DashboardContentSkeleton />;
  }

  if (userRole === 'technician') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Technician Dashboard</h1>
          <p className="text-muted-foreground">Today&apos;s services and stock status</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg p-3 bg-blue-50">
                <Wrench className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Today&apos;s Services</p>
                <p className="text-xl font-bold">{loading ? '...' : services.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg p-3 bg-amber-50">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Dues</p>
                <p className="text-xl font-bold text-amber-700">{loading ? '...' : formatCurrency(technicianDues)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg p-3 bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Low Stock</p>
                <p className="text-xl font-bold text-red-700">{loading ? '...' : lowStockItems.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Today&apos;s Services</CardTitle>
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
              <p className="text-sm text-muted-foreground py-6 text-center">No services scheduled for today</p>
            ) : (
              <div className="space-y-2">
                {services.map((service: any) => {
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
                          </div>
                        </div>
                        <Badge className={getStatusColor(getEffectiveServiceStatus(service.status, service.scheduled_date))}>
                          {SERVICE_STATUS_LABELS[getEffectiveServiceStatus(service.status, service.scheduled_date) as keyof typeof SERVICE_STATUS_LABELS] || service.status}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Stock Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loading />
            ) : lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">All stocks are above minimum levels.</p>
            ) : (
              <div className="space-y-2">
                {lowStockItems.slice(0, 10).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Min: {item.min_stock_level ?? 0}{item.unit_of_measure ? ` ${item.unit_of_measure}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-red-600">
                      {item.stock_quantity}{item.unit_of_measure ? ` ${item.unit_of_measure}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            Quick Summary
          </CardTitle>
          <Link href="/dashboard/day-book">
            <Button size="sm">View Day Book</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Sales</p><p className="font-bold">{formatCurrency(dayBook.sales)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Services</p><p className="font-bold">{dayBook.services}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Expenses</p><p className="font-bold text-red-600">{formatCurrency(dayBook.expenses)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Dues</p><p className="font-bold text-amber-600">{formatCurrency(dayBook.dues)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Profit</p><p className={`font-bold ${dayBook.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(dayBook.profit)}</p></div>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-purple-600" />
            WhatsApp Message Summary
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {MESSAGE_TIME_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => setMessageFilter(chip.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  messageFilter === chip.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {chip.label}
              </button>
            ))}
            {messageFilter === 'custom' && (
              <DateRangePicker
                from={messageCustomFrom}
                to={messageCustomTo}
                onChange={(from, to) => {
                  setMessageCustomFrom(from);
                  setMessageCustomTo(to);
                }}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Total Messages Sent</p>
              <p className="text-2xl font-bold">{messageStatsLoading ? '...' : whatsAppMessageCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Estimated Cost (₹0.8 × count)</p>
              <p className="text-2xl font-bold text-purple-700">
                {messageStatsLoading ? '...' : formatCurrency(whatsAppMessageCost)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
