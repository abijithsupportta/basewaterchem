'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useServices } from '@/hooks/use-services';
import { formatDate, getStatusColor, cn } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from '@/lib/constants';

const STATUS_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'assigned', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TIME_CHIPS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

function getDateRange(period: string): { from?: string; to?: string } {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  switch (period) {
    case 'today':
      return { from: todayStr, to: todayStr };
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

export default function ServicesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateRange = useMemo(() => {
    if (timeFilter === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    return getDateRange(timeFilter);
  }, [timeFilter, customFrom, customTo]);

  const filters = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  }), [statusFilter, typeFilter, dateRange]);

  const { services, loading } = useServices(filters);

  const filtered = services.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.service_number?.toLowerCase().includes(q) ||
      (s.customer as any)?.full_name?.toLowerCase().includes(q) ||
      (s.customer as any)?.customer_code?.toLowerCase().includes(q) ||
      (s.customer as any)?.phone?.includes(q);
  });

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-muted-foreground">{filtered.length} service{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/services/upcoming"><Button variant="outline">Upcoming</Button></Link>
          <Link href="/dashboard/services/schedule"><Button variant="outline">Schedule</Button></Link>
          <Link href="/dashboard/services/new"><Button><Plus className="mr-2 h-4 w-4" /> New Service</Button></Link>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setStatusFilter(chip.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                statusFilter === chip.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Time filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {TIME_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setTimeFilter(chip.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                timeFilter === chip.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
              )}
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
      </div>

      {/* Search + type filter */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by service #, customer, phone..." />
        </div>
        <select className="rounded-md border px-3 py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="amc_service">Recurring Service</option>
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
