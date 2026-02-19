'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatCurrency } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase/client';

export default function RevenueReportPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    const fetchStats = async () => {
      const [invoices, paidInvoices, amcContracts, services] = await Promise.all([
        supabase.from('invoices').select('total_amount, amount_paid, balance_due'),
        supabase.from('invoices').select('total_amount').eq('payment_status', 'paid'),
        supabase.from('amc_contracts').select('contract_amount').eq('status', 'active'),
        supabase.from('services').select('actual_amount').eq('status', 'completed').gt('actual_amount', 0),
      ]);

      const totalInvoiced = invoices.data?.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0) || 0;
      const totalCollected = invoices.data?.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0) || 0;
      const totalOutstanding = invoices.data?.reduce((sum: number, inv: any) => sum + (inv.balance_due || 0), 0) || 0;
      const activeAMCRevenue = amcContracts.data?.reduce((sum: number, c: any) => sum + (c.contract_amount || 0), 0) || 0;
      const serviceRevenue = services.data?.reduce((sum: number, s: any) => sum + (s.actual_amount || 0), 0) || 0;

      setStats({ totalInvoiced, totalCollected, totalOutstanding, activeAMCRevenue, serviceRevenue });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">Revenue Report</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Invoiced</p><p className="text-2xl font-bold">{formatCurrency(stats?.totalInvoiced)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Collected</p><p className="text-2xl font-bold text-green-600">{formatCurrency(stats?.totalCollected)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Outstanding</p><p className="text-2xl font-bold text-red-600">{formatCurrency(stats?.totalOutstanding)}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Active AMC Revenue</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(stats?.activeAMCRevenue)}</p><p className="text-xs text-muted-foreground mt-1">Total value of active AMC contracts</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Service Revenue</p><p className="text-2xl font-bold text-purple-600">{formatCurrency(stats?.serviceRevenue)}</p><p className="text-xs text-muted-foreground mt-1">From completed services</p></CardContent></Card>
      </div>

      {stats && stats.totalInvoiced > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Collection Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>Collected</span><span>{((stats.totalCollected / stats.totalInvoiced) * 100).toFixed(1)}%</span></div>
              <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${(stats.totalCollected / stats.totalInvoiced) * 100}%` }} /></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
