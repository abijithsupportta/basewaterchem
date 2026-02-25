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
import { formatCurrency, formatDate, getEffectiveServiceStatus, getStatusColor } from '@/lib/utils';
import { SERVICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';
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

function isDateWithinRange(dateValue: string | null | undefined, range: { from?: string; to?: string }) {
  if (!dateValue) return false;

  const dateOnly = dateValue.split('T')[0];
  if (range.from && dateOnly < range.from) return false;
  if (range.to && dateOnly > range.to) return false;
  return true;
}

export default function DayBookPage() {
  const userRole = useUserRole();
  const canManageExpenses = canCreateOrEdit(userRole as any);
  const [timeFilter, setTimeFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
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
      .select('id, expense_date, title, category, amount, payment_method, reference_no, description')
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
    const invoiceSales = invoices.reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0);
    const collected = invoices.reduce((sum: number, i: any) => sum + (i.amount_paid || 0), 0);
    const dues = invoices.reduce((sum: number, i: any) => sum + (i.balance_due || 0), 0);
    const serviceRevenue = services
      .filter(
        (s: any) =>
          s.status === 'completed' &&
          isDateWithinRange(s.completed_date || s.scheduled_date, dateRange)
      )
      .reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
    const expensesTotal = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const profit = collected + serviceRevenue - expensesTotal;

    return {
      invoiceSales,
      totalSales: invoiceSales + serviceRevenue,
      serviceRevenue,
      expensesTotal,
      collected,
      dues,
      profit,
    };
  }, [invoices, services, expenses, dateRange]);

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

  const sortExpenses = (list: any[]) =>
    [...list].sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

  const expenseInCurrentRange = (expenseDate: string) => isDateWithinRange(expenseDate, dateRange);

  const upsertExpense = (expense: any) => {
    setExpenses((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== expense.id);

      if (!expenseInCurrentRange(expense.expense_date)) {
        return sortExpenses(withoutCurrent);
      }

      return sortExpenses([expense, ...withoutCurrent]);
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

      const savedExpense = payload?.data;
      if (savedExpense?.id) {
        upsertExpense(savedExpense);
      }

      toast.success(editingExpenseId ? 'Expense updated' : 'Expense added');
      resetExpenseForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const startEditExpense = (expense: any) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      expense_date: expense.expense_date,
      title: expense.title || '',
      category: expense.category || 'misc',
      amount: String(expense.amount ?? ''),
      payment_method: expense.payment_method || 'cash',
      reference_no: expense.reference_no || '',
      description: expense.description || '',
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
      setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete expense');
    }
  };

  const downloadStatement = () => {
    downloadDayBookPDF({
      periodLabel: timeFilter,
      from: dateRange.from,
      to: dateRange.to,
      summary: {
        sales: totals.totalSales,
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Invoice Sales</p><p className="font-bold">{formatCurrency(totals.invoiceSales)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Service Sales</p><p className="font-bold">{formatCurrency(totals.serviceRevenue)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Sales</p><p className="font-bold">{formatCurrency(totals.totalSales)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Services</p><p className="font-bold">{services.length}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Expenses</p><p className="font-bold text-red-600">{formatCurrency(totals.expensesTotal)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Dues</p><p className="font-bold text-amber-600">{formatCurrency(totals.dues)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Profit</p><p className={`font-bold ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(totals.profit)}</p></div>
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
                    date: srv.completed_date || srv.scheduled_date,
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
                    rawExpense: exp,
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
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{entry.status}</span>
                            {entry.type === 'Expense' && canManageExpenses && (
                              <Button variant="ghost" size="icon" onClick={() => startEditExpense(entry.rawExpense)}>
                                <Pencil className="h-3 w-3 text-blue-500" />
                              </Button>
                            )}
                            {entry.type === 'Expense' && canDelete(userRole) && (
                              <Button variant="ghost" size="icon" onClick={() => deleteExpense(entry.rawExpense.id)}>
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </td>
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
