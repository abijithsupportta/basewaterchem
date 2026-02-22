'use client';

import { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useExpenses } from '@/hooks/use-expenses';
import { downloadDayBookPDF } from '@/lib/daybook-pdf';
import { createBrowserClient } from '@/lib/supabase/client';
import { useUserRole } from '@/lib/use-user-role';
import { canCreateOrEdit, canDelete } from '@/lib/authz';

type Period = 'daily' | 'weekly' | 'monthly' | 'custom';

function getRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (period === 'daily') return { from: today, to: today };
  if (period === 'weekly') {
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
  }
  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
  }
  return { from: today, to: today };
}

const categories = ['travel', 'salary', 'office', 'utilities', 'maintenance', 'marketing', 'purchase', 'misc'];

export default function ExpensesPage() {
  const userRole = useUserRole();
  const canManageExpenses = canCreateOrEdit(userRole as any);
  const [period, setPeriod] = useState<Period>('daily');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const range = useMemo(() => {
    if (period === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    const r = getRange(period);
    return { from: r.from, to: r.to };
  }, [period, customFrom, customTo]);

  const { expenses, loading, fetchExpenses } = useExpenses(range);

  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    title: '',
    category: 'misc',
    amount: '',
    payment_method: 'cash',
    reference_no: '',
    description: '',
  });

  const totalExpense = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const saveExpense = async () => {
    if (!canManageExpenses) {
      toast.error('You do not have permission to manage expenses');
      return;
    }

    if (!form.title || !form.amount) {
      toast.error('Title and amount are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(editingExpenseId ? `/api/expenses/${editingExpenseId}` : '/api/expenses', {
        method: editingExpenseId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_date: form.expense_date,
          title: form.title,
          category: form.category,
          amount: Number(form.amount),
          payment_method: form.payment_method,
          reference_no: form.reference_no || undefined,
          description: form.description || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || payload?.error || 'Failed to save expense');

      toast.success(editingExpenseId ? 'Expense updated' : 'Expense added');
      setForm((prev) => ({ ...prev, title: '', amount: '', reference_no: '', description: '' }));
      setEditingExpenseId(null);
      await fetchExpenses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const startEditExpense = (exp: any) => {
    setEditingExpenseId(exp.id);
    setForm({
      expense_date: exp.expense_date,
      title: exp.title,
      category: exp.category,
      amount: String(exp.amount ?? ''),
      payment_method: exp.payment_method || 'cash',
      reference_no: exp.reference_no || '',
      description: exp.description || '',
    });
  };

  const cancelEdit = () => {
    setEditingExpenseId(null);
    setForm({
      expense_date: new Date().toISOString().split('T')[0],
      title: '',
      category: 'misc',
      amount: '',
      payment_method: 'cash',
      reference_no: '',
      description: '',
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
      if (!response.ok) throw new Error(payload?.error?.message || payload?.error || 'Failed to delete expense');
      toast.success('Expense deleted');
      await fetchExpenses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete expense');
    }
  };

  const downloadStatement = async () => {
    try {
      const supabase = createBrowserClient();
      let invQuery = supabase
        .from('invoices')
        .select('invoice_number, invoice_date, total_amount, amount_paid, balance_due, customer:customers(full_name)');
      let serviceQuery = supabase
        .from('services')
        .select('service_number, status, payment_status, total_amount, scheduled_date, completed_date, customer:customers(full_name)');

      if (range.from) invQuery = invQuery.gte('invoice_date', range.from);
      if (range.to) invQuery = invQuery.lte('invoice_date', range.to);
      if (range.from) serviceQuery = serviceQuery.gte('scheduled_date', range.from);
      if (range.to) serviceQuery = serviceQuery.lte('scheduled_date', range.to);

      const [{ data: invoices }, { data: services }] = await Promise.all([
        invQuery,
        serviceQuery,
      ]);

      const sales = (invoices || []).reduce((sum, i: any) => sum + (i.total_amount || 0), 0);
      const collected = (invoices || []).reduce((sum, i: any) => sum + (i.amount_paid || 0), 0);
      const dues = (invoices || []).reduce((sum, i: any) => sum + (i.balance_due || 0), 0);
      const servicesCount = (services || []).length;
      const revenue = (services || [])
        .filter((s: any) => s.status === 'completed')
        .reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);

      downloadDayBookPDF({
        periodLabel: period,
        from: range.from,
        to: range.to,
        summary: {
          sales: sales + revenue,
          services: servicesCount,
          revenue,
          expenses: totalExpense,
          dues,
          collected,
          profit: collected + revenue - totalExpense,
        },
        rows: {
          invoices: (invoices || []).map((i: any) => ({
            invoice_number: i.invoice_number,
            invoice_date: i.invoice_date,
            customer_name: i.customer?.full_name,
            total_amount: i.total_amount,
            amount_paid: i.amount_paid,
            balance_due: i.balance_due,
          })),
          services: (services || []).map((s: any) => ({
            service_number: s.service_number,
            scheduled_date: s.scheduled_date,
            customer_name: s.customer?.full_name,
            status: s.status,
            total_amount: s.total_amount,
            payment_status: s.payment_status,
          })),
          expenses: expenses.map((exp) => ({
            expense_date: exp.expense_date,
            title: exp.title,
            category: exp.category,
            amount: exp.amount,
            payment_method: exp.payment_method,
          })),
        },
      });
    } catch {
      toast.error('Failed to download statement');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expense Management</h1>
          <p className="text-muted-foreground">Track daily operational expenses and day-book statements</p>
        </div>
        <Button onClick={downloadStatement}>Download Statement PDF</Button>
      </div>

      {!canManageExpenses && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-3 text-sm text-amber-700">
            View-only mode: only admin/manager/staff can add or delete expenses.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['daily', 'weekly', 'monthly', 'custom'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${period === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'}`}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
        {period === 'custom' && (
          <DateRangePicker
            from={customFrom}
            to={customTo}
            onChange={(from, to) => {
              setCustomFrom(from);
              setCustomTo(to);
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Entries</p>
            <p className="text-xl font-bold">{expenses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">From</p>
            <p className="text-sm font-semibold">{range.from ? formatDate(range.from) : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">To</p>
            <p className="text-sm font-semibold">{range.to ? formatDate(range.to) : '-'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.expense_date} onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Fuel for field visit" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.payment_method} onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={form.reference_no} onChange={(e) => setForm((p) => ({ ...p, reference_no: e.target.value }))} placeholder="Txn/Receipt #" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveExpense} disabled={saving || !canManageExpenses}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} {editingExpenseId ? 'Update Expense' : 'Add Expense'}
            </Button>
            {editingExpenseId && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancel Edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" />Expense Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Loading /> : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expense entries in this period.</p>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="rounded-lg border p-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{exp.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(exp.expense_date)} | {exp.category} | {exp.payment_method || 'N/A'}
                      {exp.reference_no ? ` | Ref: ${exp.reference_no}` : ''}
                    </p>
                    {exp.description && <p className="text-xs text-muted-foreground mt-1 truncate">{exp.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-red-600 whitespace-nowrap">{formatCurrency(exp.amount)}</p>
                    <Button variant="ghost" size="icon" onClick={() => startEditExpense(exp)} disabled={!canManageExpenses}>
                      <Pencil className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteExpense(exp.id)} disabled={!canDelete(userRole)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
