'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { useAmc } from '@/hooks/use-amc';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { AMC_STATUS_LABELS } from '@/lib/constants';

export default function AMCPage() {
  const { contracts, loading } = useAmc();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = contracts.filter((c: any) => {
    const matchesSearch = !search ||
      c.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      (c.customer as any)?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">AMC Contracts</h1><p className="text-muted-foreground">{contracts.length} contracts</p></div>
        <p className="text-sm text-muted-foreground">AMC contracts are created from Invoices with AMC enabled</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search by contract # or customer..." /></div>
        <select className="rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="pending_renewal">Pending Renewal</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{search || statusFilter !== 'all' ? 'No contracts match filters' : 'No AMC contracts yet. Create an invoice with AMC enabled.'}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((contract: any) => (
            <Link key={contract.id} href={`/dashboard/amc/${contract.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{contract.contract_number}</p>
                      <span className="text-sm text-muted-foreground">•</span>
                      <p className="text-sm">{(contract.customer as any)?.full_name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(contract.start_date)} → {formatDate(contract.end_date)} |
                      Every {contract.service_interval_months} months |
                      {formatCurrency(contract.amount)}
                      {contract.invoice?.invoice_number && ` | Invoice: ${contract.invoice.invoice_number}`}
                    </p>
                    {contract.status === 'active' && contract.next_service_date && (
                      <p className="text-sm font-medium text-blue-600 mt-1">Next AMC: {formatDate(contract.next_service_date)}</p>
                    )}
                    {contract.status === 'active' && !contract.next_service_date && (
                      <p className="text-sm font-medium text-yellow-600 mt-1">AMC Pending</p>
                    )}
                  </div>
                  <Badge className={getStatusColor(contract.status)}>{AMC_STATUS_LABELS[contract.status as keyof typeof AMC_STATUS_LABELS] || contract.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
