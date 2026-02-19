'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { createBrowserClient } from '@/lib/supabase/client';

export default function AMCReportPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    const fetchStats = async () => {
      const [total, active, expired, pending] = await Promise.all([
        supabase.from('amc_contracts').select('id', { count: 'exact', head: true }),
        supabase.from('amc_contracts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('amc_contracts').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
        supabase.from('amc_contracts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setStats({
        total: total.count || 0,
        active: active.count || 0,
        expired: expired.count || 0,
        pending: pending.count || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">AMC Report</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Contracts</p><p className="text-3xl font-bold">{stats?.total}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Active</p><p className="text-3xl font-bold text-green-600">{stats?.active}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Expired</p><p className="text-3xl font-bold text-red-600">{stats?.expired}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Pending</p><p className="text-3xl font-bold text-yellow-600">{stats?.pending}</p></CardContent></Card>
      </div>

      {stats && stats.total > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Contract Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>Active</span><span>{((stats.active / stats.total) * 100).toFixed(1)}%</span></div>
              <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${(stats.active / stats.total) * 100}%` }} /></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>Expired (need renewal)</span><span>{((stats.expired / stats.total) * 100).toFixed(1)}%</span></div>
              <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{ width: `${(stats.expired / stats.total) * 100}%` }} /></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
