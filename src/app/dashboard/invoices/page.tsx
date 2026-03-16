'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import type { InvoiceSortBy } from '@/types';

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type InvoiceStatusFilter = 'all' | 'pending_due' | 'draft' | 'paid' | 'partial';

const INVOICE_SORT_OPTIONS: InvoiceSortBy[] = [
  'invoice_date_desc',
  'invoice_date_asc',
  'created_at_desc',
  'created_at_asc',
  'total_amount_desc',
  'total_amount_asc',
  'balance_due_desc',
  'balance_due_asc',
];

const DATE_FILTER_OPTIONS: DateFilter[] = ['all', 'today', 'yesterday', 'week', 'month', 'custom'];
const STATUS_FILTER_OPTIONS: InvoiceStatusFilter[] = ['all', 'pending_due', 'draft', 'paid', 'partial'];

function isInvoiceSortBy(value: string | null): value is InvoiceSortBy {
  return !!value && INVOICE_SORT_OPTIONS.includes(value as InvoiceSortBy);
}

function isDateFilter(value: string | null): value is DateFilter {
  return !!value && DATE_FILTER_OPTIONS.includes(value as DateFilter);
}

function isStatusFilter(value: string | null): value is InvoiceStatusFilter {
  return !!value && STATUS_FILTER_OPTIONS.includes(value as InvoiceStatusFilter);
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null, fallback: number): number {
  const parsed = parsePositiveInt(value, fallback);
  return [20, 50, 100].includes(parsed) ? parsed : fallback;
}

function getInvoiceFiltersFromUrl(): {
  search: string;
  status: InvoiceStatusFilter;
  sortBy: InvoiceSortBy;
  dateFilter: DateFilter;
  customStartDate: string;
  customEndDate: string;
  page: number;
  pageSize: number;
} {
  if (typeof window === 'undefined') {
    return {
      search: '',
      status: 'all',
      sortBy: 'invoice_date_desc',
      dateFilter: 'all',
      customStartDate: '',
      customEndDate: '',
      page: 1,
      pageSize: 20,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const dateFilterParam = params.get('dateFilter');
  const resolvedDateFilter = isDateFilter(dateFilterParam) ? dateFilterParam : 'all';
  const customStartDate = resolvedDateFilter === 'custom' ? (params.get('dateFrom') || '') : '';
  const customEndDate = resolvedDateFilter === 'custom' ? (params.get('dateTo') || '') : '';
  const statusParam = params.get('status');
  const sortParam = params.get('sort');

  return {
    search: params.get('search') || '',
    status: isStatusFilter(statusParam) ? statusParam : 'all',
    sortBy: isInvoiceSortBy(sortParam) ? sortParam : 'invoice_date_desc',
    dateFilter: resolvedDateFilter,
    customStartDate,
    customEndDate,
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: parsePageSize(params.get('pageSize'), 20),
  };
}

export default function InvoicesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userRole = useUserRole();
  const [page, setPage] = useState(() => getInvoiceFiltersFromUrl().page);
  const [pageSize, setPageSize] = useState(() => getInvoiceFiltersFromUrl().pageSize);
  const [search, setSearch] = useState(() => getInvoiceFiltersFromUrl().search);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>(() => getInvoiceFiltersFromUrl().status);
  const [sortBy, setSortBy] = useState<InvoiceSortBy>(() => getInvoiceFiltersFromUrl().sortBy);
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => getInvoiceFiltersFromUrl().dateFilter);
  const [customStartDate, setCustomStartDate] = useState(() => getInvoiceFiltersFromUrl().customStartDate);
  const [customEndDate, setCustomEndDate] = useState(() => getInvoiceFiltersFromUrl().customEndDate);
  const [latestCollectors, setLatestCollectors] = useState<Record<string, string>>({});
  const [latestCollectionAt, setLatestCollectionAt] = useState<Record<string, string>>({});
  const hasInitializedPageReset = useRef(false);

  const currentListUrl = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncFromUrl = () => {
      const next = getInvoiceFiltersFromUrl();
      setSearch((prev) => (prev === next.search ? prev : next.search));
      setStatusFilter((prev) => (prev === next.status ? prev : next.status));
      setSortBy((prev) => (prev === next.sortBy ? prev : next.sortBy));
      setDateFilter((prev) => (prev === next.dateFilter ? prev : next.dateFilter));
      setCustomStartDate((prev) => (prev === next.customStartDate ? prev : next.customStartDate));
      setCustomEndDate((prev) => (prev === next.customEndDate ? prev : next.customEndDate));
      setPage((prev) => (prev === next.page ? prev : next.page));
      setPageSize((prev) => (prev === next.pageSize ? prev : next.pageSize));
    };

    const onPopState = () => {
      syncFromUrl();
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (!search.trim()) {
      params.delete('search');
    } else {
      params.set('search', search.trim());
    }

    if (statusFilter === 'all') {
      params.delete('status');
    } else {
      params.set('status', statusFilter);
    }

    if (sortBy === 'invoice_date_desc') {
      params.delete('sort');
    } else {
      params.set('sort', sortBy);
    }

    if (dateFilter === 'all') {
      params.delete('dateFilter');
      params.delete('dateFrom');
      params.delete('dateTo');
    } else {
      params.set('dateFilter', dateFilter);
      if (dateFilter === 'custom') {
        if (customStartDate) {
          params.set('dateFrom', customStartDate);
        } else {
          params.delete('dateFrom');
        }
        if (customEndDate) {
          params.set('dateTo', customEndDate);
        } else {
          params.delete('dateTo');
        }
      } else {
        params.delete('dateFrom');
        params.delete('dateTo');
      }
    }

    if (page <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }

    if (pageSize === 20) {
      params.delete('pageSize');
    } else {
      params.set('pageSize', String(pageSize));
    }

    const nextQuery = params.toString();
    const currentQuery = new URLSearchParams(window.location.search).toString();
    if (nextQuery === currentQuery) {
      return;
    }

    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);

  }, [search, statusFilter, sortBy, dateFilter, customStartDate, customEndDate, page, pageSize]);

  // Prevent technicians from accessing invoices
  useEffect(() => {
    if (userRole === 'technician') {
      router.replace('/dashboard');
    }
  }, [userRole, router]);

  useEffect(() => {
    if (!hasInitializedPageReset.current) {
      hasInitializedPageReset.current = true;
      return;
    }
    setPage(1);
  }, [search, statusFilter, sortBy, dateFilter, customStartDate, customEndDate, pageSize]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let range: { start: Date; end: Date } | null = null;

    switch (dateFilter) {
      case 'today': {
        range = { start: today, end: new Date(today.getTime() + 86400000 - 1) };
        break;
      }
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        range = { start: yesterday, end: new Date(yesterday.getTime() + 86400000 - 1) };
        break;
      }
      case 'week': {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        range = { start: weekStart, end: weekEnd };
        break;
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        range = { start: monthStart, end: monthEnd };
        break;
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          range = { start, end };
        }
        break;
      }
      default:
        range = null;
    }

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
    sortBy,
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

  // Render after all hooks to keep hook call order stable.
  if (userRole === 'technician') {
    return <Loading />;
  }

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
        <select className="rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvoiceStatusFilter)}>
          <option value="all">All Status</option>
          <option value="pending_due">Pending Due</option>
          <option value="draft">Due</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as InvoiceSortBy)}>
          <option value="invoice_date_desc">Invoice Date: Latest to Oldest</option>
          <option value="invoice_date_asc">Invoice Date: Oldest to Latest</option>
          <option value="created_at_desc">Added: Newest First</option>
          <option value="created_at_asc">Added: Oldest First</option>
          <option value="total_amount_desc">Amount: High to Low</option>
          <option value="total_amount_asc">Amount: Low to High</option>
          <option value="balance_due_desc">Due Amount: High to Low</option>
          <option value="balance_due_asc">Due Amount: Low to High</option>
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
            <Link key={inv.id} href={`/dashboard/invoices/${inv.id}?returnTo=${encodeURIComponent(currentListUrl)}`}>
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
