'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loading } from '@/components/ui/loading';
import { formatCurrency, formatDate } from '@/lib/utils';
import { downloadDayBookPDF } from '@/lib/daybook-pdf';
import { toast } from 'sonner';
import { useUserRole } from '@/lib/use-user-role';
import { canCreateOrEdit, canDelete } from '@/lib/authz';

const TIME_CHIPS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

const EXPENSE_CATEGORIES = ['travel', 'salary', 'office', 'utilities', 'maintenance', 'marketing', 'purchase', 'misc'];

interface DayBookEntry {
  entry_key: string;
  entry_date: string;
  entry_type: 'Sales' | 'Service' | 'Expense';
  reference: string;
  description: string;
  amount: number;
  dues: number;
  status: string;
  source_id: string;
  expense_date?: string | null;
  expense_title?: string | null;
  expense_category?: string | null;
  expense_amount?: number | null;
  expense_payment_method?: string | null;
  expense_reference_no?: string | null;
  expense_description?: string | null;
}

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
  const userRole = useUserRole();
  const canManageExpenses = canCreateOrEdit(userRole as any);

  const [timeFilter, setTimeFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [summary, setSummary] = useState({
    invoiceSales: 0,
    serviceRevenue: 0,
    totalRevenue: 0,
    expensesTotal: 0,
    collected: 0,
    dues: 0,
    totalInvoices: 0,
    totalSalesDone: 0,
    totalServices: 0,
    totalExpenses: 0,
  });
  const [cappedFrom, setCappedFrom] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [savingExpense, setSavingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    title: '',
    category: 'misc',
    amount: '',
    payment_method: 'cash',
    reference_no: '',
    description: '',
  });

  const dateRange = useMemo(() => {
    if (timeFilter === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    return getDateRange(timeFilter);
  }, [timeFilter, customFrom, customTo]);

  useEffect(() => {
    setPage(1);
  }, [timeFilter, customFrom, customTo, pageSize]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (dateRange.from) query.set('from', dateRange.from);
      if (dateRange.to) query.set('to', dateRange.to);
      query.set('page', String(page));
      query.set('limit', String(pageSize));

      const [summaryResRaw, entriesResRaw] = await Promise.all([
        fetch(`/api/day-book/summary?${query.toString()}`),
        fetch(`/api/day-book/entries?${query.toString()}`),
      ]);

      const summaryRes = await summaryResRaw.json();
      const entriesRes = await entriesResRaw.json();

      if (summaryRes?.success && summaryRes?.data) {
        setSummary({
          invoiceSales: Number(summaryRes.data.invoiceSales || 0),
          serviceRevenue: Number(summaryRes.data.serviceRevenue || 0),
          totalRevenue: Number(summaryRes.data.totalRevenue || 0),
          expensesTotal: Number(summaryRes.data.expensesTotal || 0),
          collected: Number(summaryRes.data.collected || 0),
          dues: Number(summaryRes.data.dues || 0),
          totalInvoices: Number(summaryRes.data.totalInvoices || 0),
          totalSalesDone: Number(summaryRes.data.totalSalesDone || 0),
          totalServices: Number(summaryRes.data.totalServices || 0),
          totalExpenses: Number(summaryRes.data.totalExpenses || 0),
        });
      }

      if (entriesRes?.success && entriesRes?.data) {
        setEntries((entriesRes.data.entries || []) as DayBookEntry[]);
        setTotalCount(Number(entriesRes.data.meta?.total || 0));
        setCappedFrom(entriesRes.data.cappedFrom || null);
      } else {
        setEntries([]);
        setTotalCount(0);
        setCappedFrom(null);
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, page, pageSize]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const totals = useMemo(() => {
    const invoiceSales = summary.invoiceSales;
    const collected = summary.collected;
    const dues = summary.dues;
    const serviceRevenue = summary.serviceRevenue;
    const totalRevenue = summary.totalRevenue || (invoiceSales + serviceRevenue);
    const expensesTotal = summary.expensesTotal;
    const profit = totalRevenue - expensesTotal;

    return {
      invoiceSales,
      totalSales: totalRevenue,
      serviceRevenue,
      expensesTotal,
      collected,
      dues,
      profit,
      totalInvoices: summary.totalInvoices,
      totalSalesDone: summary.totalSalesDone,
      totalServices: summary.totalServices,
      totalExpenses: summary.totalExpenses,
    };
  }, [summary]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseForm({
      expense_date: new Date().toISOString().split('T')[0],
      title: '',
      category: 'misc',
      amount: '',
      payment_method: 'cash',
      reference_no: '',
      description: '',
    });
  };

  const saveExpense = async () => {
    if (!canManageExpenses) {
      toast.error('You do not have permission to manage expenses');
      return;
    }

    if (!expenseForm.title.trim() || !expenseForm.amount) {
      toast.error('Title and amount are required');
      return;
    }

    setSavingExpense(true);
    try {
      const response = await fetch(
        editingExpenseId ? `/api/expenses/${editingExpenseId}` : '/api/expenses',
        {
          method: editingExpenseId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expense_date: expenseForm.expense_date,
            title: expenseForm.title.trim(),
            category: expenseForm.category,
            amount: Number(expenseForm.amount),
            payment_method: expenseForm.payment_method,
            reference_no: expenseForm.reference_no || undefined,
            description: expenseForm.description || undefined,
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.error || 'Failed to save expense');
      }

      toast.success(editingExpenseId ? 'Expense updated' : 'Expense added');
      resetExpenseForm();
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const startEditExpense = (entry: DayBookEntry) => {
    setEditingExpenseId(entry.source_id);
    setExpenseForm({
      expense_date: entry.expense_date || new Date().toISOString().split('T')[0],
      title: entry.expense_title || '',
      category: entry.expense_category || 'misc',
      amount: String(entry.expense_amount ?? ''),
      payment_method: entry.expense_payment_method || 'cash',
      reference_no: entry.expense_reference_no || '',
      description: entry.expense_description || '',
    });
  };

  const deleteExpense = async (id: string) => {
    if (!canDelete(userRole)) {
      toast.error('You do not have permission to delete expenses');
      return;
    }

    try {
      const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.error || 'Failed to delete expense');
      }
      toast.success('Expense deleted');
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete expense');
    }
  };

  const downloadStatement = async () => {
    try {
      const query = new URLSearchParams();
      if (dateRange.from) query.set('from', dateRange.from);
      if (dateRange.to) query.set('to', dateRange.to);
      query.set('page', '1');
      query.set('limit', '5000');

      const entriesResRaw = await fetch(`/api/day-book/entries?${query.toString()}`);
      const entriesRes = await entriesResRaw.json();

      if (!entriesRes?.success || !entriesRes?.data) {
        throw new Error('Failed to load entries for PDF');
      }

      const exportEntries = (entriesRes.data.entries || []) as DayBookEntry[];

      downloadDayBookPDF({
        periodLabel: timeFilter,
        from: dateRange.from,
        to: dateRange.to,
        summary: {
          sales: totals.totalSales,
          services: summary.totalServices,
          revenue: totals.serviceRevenue,
          expenses: totals.expensesTotal,
          dues: totals.dues,
          collected: totals.collected,
          profit: totals.profit,
        },
        rows: {
          invoices: exportEntries
            .filter((entry) => entry.entry_type === 'Sales')
            .map((entry) => ({
              invoice_number: entry.reference,
              invoice_date: entry.entry_date,
              customer_name: entry.description,
              total_amount: entry.amount,
              amount_paid: 0,
              balance_due: entry.dues,
            })),
          services: exportEntries
            .filter((entry) => entry.entry_type === 'Service')
            .map((entry) => ({
              service_number: entry.reference,
              scheduled_date: entry.entry_date,
              customer_name: entry.description,
              status: entry.status,
              total_amount: entry.amount,
              payment_status: entry.dues > 0 ? 'pending' : 'paid',
            })),
          expenses: exportEntries
            .filter((entry) => entry.entry_type === 'Expense')
            .map((entry) => ({
              expense_date: entry.expense_date || entry.entry_date,
              title: entry.expense_title || entry.description,
              category: entry.expense_category || entry.reference,
              amount: Math.abs(entry.amount),
              payment_method: entry.expense_payment_method || entry.status,
            })),
        },
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to download PDF');
    }
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
        <Button onClick={() => void downloadStatement()}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
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

      {timeFilter === 'all' && cappedFrom && (
        <p className="text-xs text-muted-foreground">
          Showing recent history from {formatDate(cappedFrom)} for instant performance.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="font-bold text-emerald-700">{formatCurrency(totals.totalSales)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Expense</p>
          <p className="font-bold text-red-600">{formatCurrency(totals.expensesTotal)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Sales</p>
          <p className="font-bold">{formatCurrency(totals.invoiceSales)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Service</p>
          <p className="font-bold">{formatCurrency(totals.serviceRevenue)}</p>
        </div>
      </div>

      <Card className="max-w-5xl">
        <CardHeader>
          <CardTitle className="text-base">Add Expense (Day Book)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={expenseForm.expense_date}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, expense_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={expenseForm.title}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Fuel for field visit"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={expenseForm.category}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={expenseForm.payment_method}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, payment_method: e.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={expenseForm.reference_no}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, reference_no: e.target.value }))}
                placeholder="Txn/Receipt #"
              />
            </div>
            <div className="space-y-2 lg:col-span-3">
              <Label>Description</Label>
              <Textarea
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveExpense} disabled={savingExpense || !canManageExpenses}>
              {savingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingExpenseId ? 'Update Expense' : 'Add Expense'}
            </Button>
            {editingExpenseId && (
              <Button variant="outline" onClick={resetExpenseForm}>
                Cancel Edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
                  {entries.map((entry) => (
                    <tr key={entry.entry_key} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{formatDate(entry.entry_date)}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={entry.entry_type === 'Expense' ? 'border-red-500 text-red-600' : entry.entry_type === 'Service' ? 'border-blue-500 text-blue-600' : 'border-green-500 text-green-600'}>
                          {entry.entry_type}
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
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{entry.status}</span>
                          {entry.entry_type === 'Expense' && canManageExpenses && (
                            <Button variant="ghost" size="icon" onClick={() => startEditExpense(entry)}>
                              <Pencil className="h-3 w-3 text-blue-500" />
                            </Button>
                          )}
                          {entry.entry_type === 'Expense' && canDelete(userRole) && (
                            <Button variant="ghost" size="icon" onClick={() => deleteExpense(entry.source_id)}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {entries.length === 0 && (
                <p className="text-sm text-muted-foreground py-12 text-center">No entries found for this period</p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
