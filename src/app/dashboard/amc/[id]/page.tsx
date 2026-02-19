'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { AMC_STATUS_LABELS, SERVICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function AMCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    Promise.all([
      supabase.from('amc_contracts').select('*, customer:customers(*), invoice:invoices(id, invoice_number, total_amount, invoice_date)').eq('id', id).single(),
      supabase.from('services').select('*').eq('amc_contract_id', id).order('scheduled_date', { ascending: true }),
    ]).then(([amcRes, srvRes]) => {
      if (amcRes.data) setContract(amcRes.data);
      if (srvRes.data) setServices(srvRes.data);
      setLoading(false);
    });
  }, [id]);

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const supabase = createBrowserClient();
      const newStart = new Date(contract.end_date);
      newStart.setDate(newStart.getDate() + 1);
      const newEnd = new Date(newStart);
      newEnd.setMonth(newEnd.getMonth() + (contract.service_interval_months || 3));

      const { data: newContract, error } = await supabase.from('amc_contracts').insert({
        customer_id: contract.customer_id,
        start_date: newStart.toISOString().split('T')[0],
        end_date: newEnd.toISOString().split('T')[0],
        service_interval_months: contract.service_interval_months,
        total_services_included: 1,
        amount: contract.amount,
      }).select().single();
      if (error) throw error;

      // Schedule service for renewed AMC
      await supabase.from('services').insert({
        customer_id: contract.customer_id,
        amc_contract_id: newContract.id,
        service_type: 'amc_service',
        status: 'scheduled',
        scheduled_date: newEnd.toISOString().split('T')[0],
        description: `AMC service - Renewal of ${contract.contract_number}`,
        is_under_amc: true,
        payment_status: 'not_applicable',
      });

      toast.success('AMC renewed! New contract created with scheduled service.');
      router.push('/dashboard/amc');
    } catch (error: any) {
      toast.error(error.message || 'Failed to renew');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) return <Loading />;
  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Contract not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/amc')}>Back to AMC</Button>
      </div>
    );
  }

  const customer = contract.customer as any;
  const invoice = contract.invoice as any;
  const isExpired = contract.status === 'expired' || new Date(contract.end_date) < new Date();

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{contract.contract_number}</h1>
            <p className="text-muted-foreground">AMC Contract</p>
          </div>
          <Badge className={getStatusColor(contract.status)}>{AMC_STATUS_LABELS[contract.status as keyof typeof AMC_STATUS_LABELS]}</Badge>
        </div>
        {isExpired && (
          <Button onClick={handleRenew} disabled={renewing}>
            {renewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Renew Contract
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
          <CardContent>
            <Link href={`/dashboard/customers/${customer?.id}`} className="hover:underline">
              <p className="font-medium">{customer?.full_name}</p>
              <p className="text-sm text-muted-foreground">{customer?.customer_code} | {customer?.phone}</p>
              <p className="text-sm text-muted-foreground">{customer?.city}</p>
            </Link>
          </CardContent>
        </Card>
        {invoice && (
          <Card>
            <CardHeader><CardTitle className="text-base">Linked Invoice</CardTitle></CardHeader>
            <CardContent>
              <Link href={`/dashboard/invoices/${invoice.id}`} className="hover:underline">
                <p className="font-medium">{invoice.invoice_number}</p>
                <p className="text-sm text-muted-foreground">Date: {formatDate(invoice.invoice_date)} | Amount: {formatCurrency(invoice.total_amount)}</p>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Period</p><p className="font-bold">{formatDate(contract.start_date)} → {formatDate(contract.end_date)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Service Interval</p><p className="text-2xl font-bold">{contract.service_interval_months} months</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Services</p><p className="text-2xl font-bold">{contract.services_completed}/{contract.total_services_included}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Amount</p><p className="text-2xl font-bold">{formatCurrency(contract.amount)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Services Under This Contract ({services.length})</CardTitle></CardHeader>
        <CardContent>
          {services.length === 0 ? <p className="text-sm text-muted-foreground">No services scheduled yet.</p> : (
            <div className="space-y-3">
              {services.map((srv: any) => (
                <Link key={srv.id} href={`/dashboard/services/${srv.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                    <div>
                      <p className="font-medium">{srv.service_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(srv.scheduled_date)}
                        {srv.completed_date && <> | Completed: {formatDate(srv.completed_date)}</>}
                      </p>
                    </div>
                    <Badge className={getStatusColor(srv.status)}>{SERVICE_STATUS_LABELS[srv.status as keyof typeof SERVICE_STATUS_LABELS] || srv.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {contract.notes && (
        <Card><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{contract.notes}</p></CardContent></Card>
      )}
    </div>
  );
}
