'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Plus, Search, Upload, Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCustomers } from '@/hooks/use-customers';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDate, formatPhone } from '@/lib/utils';
import { LoadingSpinner, EmptyState } from '@/components/ui/loading';
import { createBrowserClient } from '@/lib/supabase/client';
import { useUserRole } from '@/lib/use-user-role';
import { isSuperadmin } from '@/lib/authz';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const debouncedSearch = useDebounce(search, 300);
  const { customers, loading, error, totalCount, fetchCustomers, deleteCustomer } = useCustomers({
    search: debouncedSearch,
    page,
    pageSize,
  });
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const userRole = useUserRole();

  const handleExport = () => {
    const headers = ['customer_code', 'full_name', 'phone', 'email', 'address_line1', 'address_line2', 'city', 'state', 'pincode', 'gst_number'];
    const csvRows = [headers.join(',')];
    customers.forEach((c: any) => {
      const row = headers.map(h => {
        const val = c[h] || '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${customers.length} customers`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error('CSV file must have a header row and at least one data row');
      
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const requiredFields = ['full_name', 'phone'];
      for (const f of requiredFields) {
        if (!headers.includes(f)) throw new Error(`Missing required column: ${f}`);
      }

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
        const row: any = {};
        headers.forEach((h, idx) => { if (values[idx]) row[h] = values[idx]; });
        if (row.full_name && row.phone) rows.push(row);
      }

      if (rows.length === 0) throw new Error('No valid rows found');

      const supabase = createBrowserClient();
      const { error: insertError } = await supabase.from('customers').insert(rows);
      if (insertError) throw insertError;
      
      toast.success(`Imported ${rows.length} customers successfully!`);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isSuperadmin(userRole)) return;
    const confirmed = window.confirm(
      `Delete ${name}? This will also remove all related services and invoices.`
    );
    if (!confirmed) return;

    try {
      await deleteCustomer(id);
      toast.success('Customer deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete customer');
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={customers.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Link href="/dashboard/customers/new">
            <Button><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or code..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {customers.length} customer{customers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSpinner />
          ) : customers.length === 0 ? (
            <EmptyState
              title="No customers found"
              description={search ? 'Try adjusting your search.' : 'Get started by adding your first customer.'}
              action={
                !search && (
                  <Link href="/dashboard/customers/new">
                    <Button><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
                  </Link>
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-mono text-sm">{customer.customer_code}</TableCell>
                    <TableCell className="font-medium">{customer.full_name}</TableCell>
                    <TableCell>{formatPhone(customer.phone)}</TableCell>
                    <TableCell>{customer.city}</TableCell>
                    <TableCell>
                      {customer.branch
                        ? `${customer.branch.branch_name} (${customer.branch.branch_code})`
                        : '-'}
                    </TableCell>
                    <TableCell>{formatDate(customer.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/customers/${customer.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    {isSuperadmin(userRole) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer.id, customer.full_name)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount}
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
          <span className="text-sm">Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(totalCount / pageSize)), p + 1))} disabled={page >= Math.max(1, Math.ceil(totalCount / pageSize))}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
