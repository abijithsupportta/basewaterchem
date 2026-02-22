'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, isFreeServiceActive, getFreeServiceValidUntil } from '@/lib/utils';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function SchedulePage() {
  const [overdueServices, setOverdueServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchOverdue = async () => {
    setLoading(true);
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from('services')
      .select('*, customer:customers(full_name, customer_code, phone, city)')
      .in('status', ['scheduled', 'assigned'])
      .lt('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true });
    if (data) setOverdueServices(data);
    setLoading(false);
  };

  useEffect(() => { fetchOverdue(); }, []);

  const handleGenerateSchedule = async () => {
    setGenerating(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase.rpc('generate_all_upcoming_services');
      if (error) throw error;
      toast.success(`Generated ${data || 0} new service schedules`);
      fetchOverdue();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate schedule');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Service Schedule</h1><p className="text-muted-foreground">Auto-generate and manage service schedules</p></div>
        <Button onClick={handleGenerateSchedule} disabled={generating}>
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
          Generate Service Schedule
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base text-red-600">Overdue Services ({overdueServices.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loading /> : overdueServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overdue services - great job!</p>
          ) : (
            <div className="space-y-3">
              {overdueServices.map((s: any) => (
                <Link key={s.id} href={`/dashboard/services/${s.id}`}>
                  <Card className="hover:shadow-md transition-shadow border-red-200">
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
                          Scheduled: {formatDate(s.scheduled_date)} | {s.service_type === 'free_service' && !isFreeServiceActive(s)
                            ? 'Paid Service'
                            : SERVICE_TYPE_LABELS[s.service_type as keyof typeof SERVICE_TYPE_LABELS]} | {(s.customer as any)?.city} | {(s.customer as any)?.phone}
                        </p>
                      </div>
                      <Badge variant="destructive">Overdue</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
