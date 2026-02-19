'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase/client';

export default function ServiceReportPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    const fetchStats = async () => {
      const [total, completed, scheduled, overdue] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
        supabase.from('services').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'assigned']).lt('scheduled_date', new Date().toISOString().split('T')[0]),
      ]);
      setStats({
        total: total.count || 0,
        completed: completed.count || 0,
        scheduled: scheduled.count || 0,
        overdue: overdue.count || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">Service Report</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Services</p><p className="text-3xl font-bold">{stats?.total}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Completed</p><p className="text-3xl font-bold text-green-600">{stats?.completed}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Scheduled</p><p className="text-3xl font-bold text-blue-600">{stats?.scheduled}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Overdue</p><p className="text-3xl font-bold text-red-600">{stats?.overdue}</p></CardContent></Card>
      </div>

      {stats && stats.total > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Completion Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>Completed</span><span>{((stats.completed / stats.total) * 100).toFixed(1)}%</span></div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(stats.completed / stats.total) * 100}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
