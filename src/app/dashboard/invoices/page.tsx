'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Receipt, Calendar, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { useInvoices } from '@/hooks/use-invoices';
import { useUserRole } from '@/lib/use-user-role';
import { formatDate, formatDateTime, formatCurrency, getStatusColor } from '@/lib/utils';
import { INVOICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export default function InvoicesPage() {
  const router = useRouter();
  const userRole = useUserRole();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [latestCollectors, setLatestCollectors] = useState<Record<string, string>>({});
  const [latestCollectionAt, setLatestCollectionAt] = useState<Record<string, string>>({});

  // Prevent technicians from accessing invoices
  useEffect(() => {
    if (userRole === 'technician') {
      router.replace('/dashboard');
    }
  }, [userRole, router]);

  // If technician, return early to prevent rendering
  if (userRole === 'technician') {
    return <Loading />;
  }

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFilter, customStartDate, customEndDate, pageSize]);

  const getDateRange = (filter: DateFilter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today': {
        return { start: today, end: new Date(today.getTime() + 86400000 - 1) };
      }
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday, end: new Date(yesterday.getTime() + 86400000 - 1) };
      }
      case 'week': {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: monthStart, end: monthEnd };
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return null;
      }
      default:
        return null;
    }
  };

  const dateRange = useMemo(() => {
    const range = getDateRange(dateFilter);
    if (!range) return null;
    return {
      start: range.start.toISOString().split('T')[0],
      end: range.end.toISOString().split('T')[0],
    };
  }, [dateFilter, customStartDate, customEndDate]);

  const { invoices, loading, totalCount } = useInvoices({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
    dateFrom: dateRange?.start,
    dateTo: dateRange?.end,
    page,
    pageSize,
  });

  useEffect(() => {
    const loadLatestCollectors = async () => {
      if (!invoices.length) {
        setLatestCollectors({});
        return;
      }

      const supabase = createBrowserClient();
      const invoiceIds = invoices.map((inv: any) => inv.id);

      const { data: payments } = await supabase
        .from('invoice_payments')
        .select('invoice_id, created_by, paid_at')
        .in('invoice_id', invoiceIds)
        .order('paid_at', { ascending: false });

      if (!payments || payments.length === 0) {
        setLatestCollectors({});
        setLatestCollectionAt({});
        return;
      }

      const latestByInvoice = new Map<string, string>();
      const collectorIds = new Set<string>();

      payments.forEach((payment) => {
        if (!latestByInvoice.has(payment.invoice_id)) {
          latestByInvoice.set(payment.invoice_id, payment.created_by || '');
          if (payment.created_by) collectorIds.add(payment.created_by);
        }
      });

      let staffMap: Record<string, string> = {};
      if (collectorIds.size > 0) {
        const { data: staffRows } = await supabase
          .from('staff')
          .select('id, full_name')
          .in('id', Array.from(collectorIds));

        if (staffRows) {
          staffMap = staffRows.reduce((acc, row) => {
            acc[row.id] = row.full_name || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const invoiceCollectorMap: Record<string, string> = {};
      const invoiceCollectorTimeMap: Record<string, string> = {};
      latestByInvoice.forEach((collectorId, invoiceId) => {
        const payment = payments.find((p) => p.invoice_id === invoiceId);
        if (payment?.paid_at) {
          invoiceCollectorTimeMap[invoiceId] = payment.paid_at;
        }
        if (!collectorId) {
          invoiceCollectorMap[invoiceId] = '-';
          return;
        }
        invoiceCollectorMap[invoiceId] = staffMap[collectorId] || 'Unknown';
      });

      setLatestCollectors(invoiceCollectorMap);
      setLatestCollectionAt(invoiceCollectorTimeMap);
    };

    void loadLatestCollectors();
  }, [invoices]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Link href="/dashboard/invoices/new"><Button><Plus className="mr-2 h-4 w-4" /> New Invoice</Button></Link>
      </div>

      {/* Date Filter Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              <span>Filter by Date:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={dateFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('all')}
              >
                All Time
              </Button>
              <Button
                variant={dateFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('today')}
              >
                Today
              </Button>
              <Button
                variant={dateFilter === 'yesterday' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('yesterday')}
              >
                Yesterday
              </Button>
              <Button
                variant={dateFilter === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('week')}
              >
                This Week
              </Button>
              <Button
                variant={dateFilter === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('month')}
              >
                This Month
              </Button>
              <Button
                variant={dateFilter === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('custom')}
              >
                Custom Range
              </Button>
            </div>
            
            {/* Custom Date Range Inputs */}
            {dateFilter === 'custom' && (
              <div className="flex flex-wrap gap-3 items-center pt-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">To:</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                {customStartDate && customEndDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                      setDateFilter('all');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search invoices..." /></div>
        <select className="rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="draft">Due</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? <Loading /> : invoices.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No invoices found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: any) => (
            <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-medium">{inv.invoice_number}</p>
                      <span className="text-sm text-muted-foreground">•</span>
                      <p className="text-sm">{(inv.customer as any)?.full_name}</p>
                      {inv.amc_enabled && <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">AMC</Badge>}
                      {(inv.branch as any) && (
                        <>
                          <span className="text-sm text-muted-foreground">•</span>
                          <Badge variant="outline" className="gap-1 text-xs"><Building2 className="h-3 w-3" /> {(inv.branch as any)?.branch_name}</Badge>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(inv.invoice_date)} | Total: {formatCurrency(inv.total_amount)} | Paid: {formatCurrency(inv.amount_paid)}
                      {inv.balance_due > 0 && <span className="text-red-600 font-semibold"> | Due: {formatCurrency(inv.balance_due)}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created by: {inv.created_by_staff_name || 'Unknown'} | Last collected by:{' '}
                      <span
                        className={latestCollectionAt[inv.id] ? 'cursor-help underline decoration-dotted underline-offset-2' : ''}
                        title={latestCollectionAt[inv.id] ? `Collected on ${formatDateTime(latestCollectionAt[inv.id])}` : undefined}
                      >
                        {latestCollectors[inv.id] || '-'}
                      </span>
                    </p>
                  </div>
                  <Badge className={getStatusColor(inv.status)}>{INVOICE_STATUS_LABELS[inv.status as keyof typeof INVOICE_STATUS_LABELS] || inv.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-sm text-muted-foreground">
          Showing {startIndex}-{endIndex} of {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
