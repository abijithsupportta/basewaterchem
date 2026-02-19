'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatPhone, getStatusColor } from '@/lib/utils';
import { SERVICE_STATUS_LABELS, SERVICE_TYPE_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function TechnicianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tech, setTech] = useState<any>(null);
  const [todayServices, setTodayServices] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      supabase.from('staff').select('*').eq('id', id).single(),
      supabase.from('services').select('*, customer:customers(full_name, phone, city)').eq('assigned_to', id).eq('scheduled_date', today).order('scheduled_time_slot'),
      supabase.from('services').select('*, customer:customers(full_name)').eq('assigned_to', id).order('scheduled_date', { ascending: false }).limit(30),
    ]).then(([tRes, todayRes, allRes]) => {
      if (tRes.data) setTech(tRes.data);
      if (todayRes.data) setTodayServices(todayRes.data);
      if (allRes.data) setAllServices(allRes.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Loading />;
  if (!tech) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Technician not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/technicians')}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-6 w-6 text-primary" /></div>
          <div><h1 className="text-2xl font-bold">{tech.full_name}</h1><p className="text-muted-foreground">{formatPhone(tech.phone)}</p></div>
        </div>
      </div>

      {todayServices.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Today&apos;s Schedule ({todayServices.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayServices.map((srv: any) => (
                <Link key={srv.id} href={`/dashboard/services/${srv.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                    <div>
                      <p className="font-medium">{srv.service_number} - {(srv.customer as any)?.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {srv.scheduled_time_slot || 'No time set'} | {(srv.customer as any)?.city} | {(srv.customer as any)?.phone}
                      </p>
                    </div>
                    <Badge className={getStatusColor(srv.status)}>{SERVICE_STATUS_LABELS[srv.status as keyof typeof SERVICE_STATUS_LABELS]}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Services</CardTitle></CardHeader>
        <CardContent>
          {allServices.length === 0 ? <p className="text-sm text-muted-foreground">No services assigned</p> : (
            <div className="space-y-3">
              {allServices.map((srv: any) => (
                <Link key={srv.id} href={`/dashboard/services/${srv.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                    <div>
                      <p className="font-medium">{srv.service_number} - {(srv.customer as any)?.full_name}</p>
                      <p className="text-sm text-muted-foreground">{SERVICE_TYPE_LABELS[srv.service_type as keyof typeof SERVICE_TYPE_LABELS]} | {formatDate(srv.scheduled_date)}</p>
                    </div>
                    <Badge className={getStatusColor(srv.status)}>{SERVICE_STATUS_LABELS[srv.status as keyof typeof SERVICE_STATUS_LABELS] || srv.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
