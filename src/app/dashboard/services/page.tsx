'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Wrench, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { useServices } from '@/hooks/use-services';
import { formatDate, getStatusColor } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from '@/lib/constants';

export default function ServicesPage() {
  const [filters, setFilters] = useState<any>({});
  const { services, loading } = useServices(filters);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = services.filter((s: any) => {
    const matchesSearch = !search || 
      s.service_number?.toLowerCase().includes(search.toLowerCase()) ||
      (s.customer as any)?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesType = typeFilter === 'all' || s.service_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-muted-foreground">{services.length} total services</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/services/upcoming"><Button variant="outline">Upcoming</Button></Link>
          <Link href="/dashboard/services/schedule"><Button variant="outline">Schedule</Button></Link>
          <Link href="/dashboard/services/new"><Button><Plus className="mr-2 h-4 w-4" /> New Service</Button></Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by service # or customer..." />
        </div>
        <select className="rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="amc_service">AMC Service</option>
          <option value="paid_service">Paid Service</option>
          <option value="installation">Installation</option>

        </select>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No services found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((service: any) => (
            <Link key={service.id} href={`/dashboard/services/${service.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{service.service_number}</p>
                      <Badge variant="outline">{SERVICE_TYPE_LABELS[service.service_type as keyof typeof SERVICE_TYPE_LABELS]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(service.customer as any)?.full_name || 'Unknown Customer'} | 
                      Scheduled: {formatDate(service.scheduled_date)}

                    </p>
                  </div>
                  <Badge className={getStatusColor(service.status)}>
                    {SERVICE_STATUS_LABELS[service.status as keyof typeof SERVICE_STATUS_LABELS] || service.status}
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
