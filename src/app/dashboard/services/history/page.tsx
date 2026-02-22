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
import { formatDate, formatCurrency, isFreeServiceActive, getFreeServiceValidUntil } from '@/lib/utils';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function ServiceHistoryPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from('services')
      .select('*, customer:customers(full_name, customer_code)')
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{s.service_number} - {(s.customer as any)?.full_name}</p>
                      {isFreeServiceActive(s) && (
                        <>
                          <Badge className="bg-emerald-100 text-emerald-800">Free Service</Badge>
                          {getFreeServiceValidUntil(s) && (
                            <span className="text-xs text-muted-foreground">
                              Free until: {formatDate(getFreeServiceValidUntil(s)!)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.service_type === 'free_service' && !isFreeServiceActive(s)
                        ? 'Paid Service'
                        : SERVICE_TYPE_LABELS[s.service_type as keyof typeof SERVICE_TYPE_LABELS]} | Completed: {formatDate(s.completed_date)}
                      {s.actual_amount > 0 && <> | {formatCurrency(s.actual_amount)}</>}
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
