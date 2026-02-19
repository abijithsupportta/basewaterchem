'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { useQuotations } from '@/hooks/use-quotations';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected', expired: 'Expired',
};

export default function QuotationsPage() {
  const { quotations, loading } = useQuotations();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = quotations.filter((q: any) => {
    const matchesSearch = !search ||
      q.quotation_number?.toLowerCase().includes(search.toLowerCase()) ||
      (q.customer as any)?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Quotations</h1><p className="text-muted-foreground">{quotations.length} quotations</p></div>
        <Link href="/dashboard/quotations/new"><Button><Plus className="mr-2 h-4 w-4" /> New Quotation</Button></Link>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search quotations..." /></div>
        <select className="rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No quotations found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((q: any) => (
            <Link key={q.id} href={`/dashboard/quotations/${q.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{q.quotation_number}</p>
                      <span className="text-sm text-muted-foreground">•</span>
                      <p className="text-sm">{(q.customer as any)?.full_name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{formatDate(q.created_at)} | Total: {formatCurrency(q.total_amount)}</p>
                  </div>
                  <Badge className={getStatusColor(q.status)}>{QUOTATION_STATUS_LABELS[q.status] || q.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
