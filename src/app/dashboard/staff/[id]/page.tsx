'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatPhone, getStatusColor } from '@/lib/utils';
import { ROLE_LABELS, SERVICE_STATUS_LABELS, SERVICE_TYPE_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    Promise.all([
      supabase.from('staff').select('*').eq('id', id).single(),
      supabase.from('services').select('*, customer:customers(full_name)').eq('assigned_to', id).order('scheduled_date', { ascending: false }).limit(20),
    ]).then(([sRes, svRes]) => {
      if (sRes.data) setMember(sRes.data);
      if (svRes.data) setServices(svRes.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Loading />;
  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Staff member not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/staff')}>Back</Button>
      </div>
    );
  }

  const completedCount = services.filter((s: any) => s.status === 'completed').length;
  const pendingCount = services.filter((s: any) => ['scheduled', 'assigned', 'in_progress'].includes(s.status)).length;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{member.full_name}</h1>
            <p className="text-muted-foreground">{formatPhone(member.phone)}</p>
          </div>
          <Badge variant="outline">{ROLE_LABELS[member.role as keyof typeof ROLE_LABELS]}</Badge>
          <Badge variant={member.is_active ? 'default' : 'secondary'}>{member.is_active ? 'Active' : 'Inactive'}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Assigned</p><p className="text-2xl font-bold">{services.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold text-green-600">{completedCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold text-orange-600">{pendingCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Assigned Services</CardTitle></CardHeader>
        <CardContent>
          {services.length === 0 ? <p className="text-sm text-muted-foreground">No services assigned</p> : (
            <div className="space-y-3">
              {services.map((srv: any) => (
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
