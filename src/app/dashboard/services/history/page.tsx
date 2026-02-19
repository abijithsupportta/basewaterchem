'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function ServiceHistoryPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from('services')
      .select('*, customer:customers(full_name, customer_code), assigned_to_staff:staff(full_name)')
      .eq('status', 'completed')
      .order('completed_date', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setServices(data);
        setLoading(false);
      });
  }, []);

  const filtered = services.filter((s: any) =>
    !search ||
    s.service_number?.toLowerCase().includes(search.toLowerCase()) ||
    (s.customer as any)?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Service History</h1><p className="text-muted-foreground">{services.length} completed services</p></div>
        <Link href="/dashboard/services"><Button variant="outline">All Services</Button></Link>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search history..." />

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <History className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No completed services found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s: any) => (
            <Link key={s.id} href={`/dashboard/services/${s.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{s.service_number} - {(s.customer as any)?.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {SERVICE_TYPE_LABELS[s.service_type as keyof typeof SERVICE_TYPE_LABELS]} | Completed: {formatDate(s.completed_date)}
                      {s.actual_amount > 0 && <> | {formatCurrency(s.actual_amount)}</>}
                      {s.assigned_to_staff && <> | {(s.assigned_to_staff as any)?.full_name}</>}
                    </p>
                  </div>
                  <Badge variant="default">Completed</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
