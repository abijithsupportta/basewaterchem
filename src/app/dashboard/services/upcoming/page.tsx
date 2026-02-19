'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, getStatusColor, getEffectiveServiceStatus } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function UpcomingServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from('services')
      .select('*, customer:customers(full_name, customer_code, phone, city)')
      .in('status', ['scheduled', 'assigned'])
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .then(({ data }) => {
        if (data) setServices(data);
        setLoading(false);
      });
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayServices = services.filter((s: any) => s.scheduled_date === today);
  const upcomingServices = services.filter((s: any) => s.scheduled_date > today);

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Upcoming Services</h1><p className="text-muted-foreground">{services.length} services scheduled</p></div>
        <Link href="/dashboard/services"><Button variant="outline">All Services</Button></Link>
      </div>

      {loading ? <Loading /> : (
        <>
          {todayServices.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Clock className="h-5 w-5 text-orange-500" /> Today ({todayServices.length})</h2>
              <div className="space-y-3">
                {todayServices.map((s: any) => (
                  <Link key={s.id} href={`/dashboard/services/${s.id}`}>
                    <Card className="hover:shadow-md transition-shadow border-orange-200">
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">{s.service_number} - {(s.customer as any)?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {SERVICE_TYPE_LABELS[s.service_type as keyof typeof SERVICE_TYPE_LABELS]} | {(s.customer as any)?.city}
                            {s.scheduled_time_slot && <> | {s.scheduled_time_slot}</>}
                          </p>
                        </div>
                        <Badge className={getStatusColor(getEffectiveServiceStatus(s.status, s.scheduled_date))}>{SERVICE_STATUS_LABELS[getEffectiveServiceStatus(s.status, s.scheduled_date) as keyof typeof SERVICE_STATUS_LABELS] || s.status}</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {upcomingServices.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-500" /> Upcoming ({upcomingServices.length})</h2>
              <div className="space-y-3">
                {upcomingServices.map((s: any) => (
                  <Link key={s.id} href={`/dashboard/services/${s.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">{s.service_number} - {(s.customer as any)?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(s.scheduled_date)} | {SERVICE_TYPE_LABELS[s.service_type as keyof typeof SERVICE_TYPE_LABELS]} | {(s.customer as any)?.city}
                          </p>
                        </div>
                        <Badge className={getStatusColor(getEffectiveServiceStatus(s.status, s.scheduled_date))}>{SERVICE_STATUS_LABELS[getEffectiveServiceStatus(s.status, s.scheduled_date) as keyof typeof SERVICE_STATUS_LABELS] || s.status}</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {services.length === 0 && (
            <Card><CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No upcoming services scheduled</p>
            </CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}
