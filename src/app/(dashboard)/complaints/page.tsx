'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { useComplaints } from '@/hooks/use-complaints';
import { formatDate, getStatusColor } from '@/lib/utils';
import { COMPLAINT_STATUS_LABELS, COMPLAINT_PRIORITY_LABELS } from '@/lib/constants';

export default function ComplaintsPage() {
  const { complaints, loading } = useComplaints();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = complaints.filter((c: any) => {
    const matchesSearch = !search ||
      c.complaint_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.subject?.toLowerCase().includes(search.toLowerCase()) ||
      (c.customer as any)?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Complaints</h1><p className="text-muted-foreground">{complaints.length} total complaints</p></div>
        <Link href="/dashboard/complaints/new"><Button><Plus className="mr-2 h-4 w-4" /> New Complaint</Button></Link>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search complaints..." /></div>
        <select className="rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No complaints found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((complaint: any) => (
            <Link key={complaint.id} href={`/dashboard/complaints/${complaint.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{complaint.complaint_number}</p>
                      <Badge variant={complaint.priority === 'high' || complaint.priority === 'urgent' ? 'destructive' : 'outline'}>
                        {COMPLAINT_PRIORITY_LABELS[complaint.priority as keyof typeof COMPLAINT_PRIORITY_LABELS] || complaint.priority}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{complaint.subject}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(complaint.customer as any)?.full_name} | {formatDate(complaint.created_at)}
                    </p>
                  </div>
                  <Badge className={getStatusColor(complaint.status)}>
                    {COMPLAINT_STATUS_LABELS[complaint.status as keyof typeof COMPLAINT_STATUS_LABELS] || complaint.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
