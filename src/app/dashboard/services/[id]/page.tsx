'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Calendar, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completionData, setCompletionData] = useState({ work_done: '', actual_amount: 0, parts_used: '' });

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    supabase
      .from('services')
      .select('*, customer:customers(*), amc_contract:amc_contracts(id, contract_number, status)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setService(data);
        setLoading(false);
      });
  }, [id]);

  const handleStartService = async () => {
    const supabase = createBrowserClient();
    const { error } = await supabase.from('services').update({ status: 'in_progress' }).eq('id', id);
    if (error) { toast.error('Failed to start'); return; }
    toast.success('Service started!');
    setService((s: any) => ({ ...s, status: 'in_progress' }));
  };

  const handleCompleteService = async () => {
    setCompleting(true);
    try {
      const supabase = createBrowserClient();
      const updateData: any = {
        status: 'completed',
        completed_date: new Date().toISOString(),
        work_done: completionData.work_done,
        actual_amount: completionData.actual_amount || 0,
      };
      if (completionData.parts_used) {
        updateData.parts_used = completionData.parts_used.split(',').map((p: string) => ({ name: p.trim() }));
      }
      const { error } = await supabase.from('services').update(updateData).eq('id', id);
      if (error) throw error;

      // If this is an AMC service, schedule the next one automatically
      if (service.service_type === 'amc_service' && service.amc_contract_id) {
        const { data: amcData } = await supabase.from('amc_contracts')
          .select('*')
          .eq('id', service.amc_contract_id)
          .single();

        if (amcData && amcData.status === 'active') {
          const completedDate = new Date();
          const nextDate = new Date(completedDate);
          nextDate.setMonth(nextDate.getMonth() + (amcData.service_interval_months || 3));
          const nextDateStr = nextDate.toISOString().split('T')[0];

          // Update AMC contract: increment services_completed, set next_service_date, extend end_date
          await supabase.from('amc_contracts').update({
            services_completed: (amcData.services_completed || 0) + 1,
            total_services_included: (amcData.total_services_included || 0) + 1,
            next_service_date: nextDateStr,
            end_date: nextDateStr,
          }).eq('id', service.amc_contract_id);

          // Create the next scheduled AMC service
          await supabase.from('services').insert({
            customer_id: service.customer_id,
            amc_contract_id: service.amc_contract_id,
            service_type: 'amc_service',
            status: 'scheduled',
            scheduled_date: nextDateStr,
            description: `AMC service - ${amcData.contract_number || 'Recurring'}`,
            is_under_amc: true,
            payment_status: 'not_applicable',
          });

          toast.success(`Service completed! Next AMC scheduled for ${nextDateStr}`);
        } else {
          toast.success('Service completed!');
        }
      } else {
        toast.success('Service completed!');
      }

      setService((s: any) => ({ ...s, ...updateData }));
      setShowCompleteForm(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <Loading />;
  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Service not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/services')}>Back to Services</Button>
      </div>
    );
  }

  const customer = service.customer as any;
  const amcContract = service.amc_contract as any;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{service.service_number}</h1>
            <p className="text-muted-foreground">{SERVICE_TYPE_LABELS[service.service_type as keyof typeof SERVICE_TYPE_LABELS]}</p>
          </div>
          <Badge className={getStatusColor(service.status)}>{SERVICE_STATUS_LABELS[service.status as keyof typeof SERVICE_STATUS_LABELS]}</Badge>
        </div>
        <div className="flex gap-2">
          {service.status === 'scheduled' && <Button variant="outline" onClick={handleStartService}>Start Service</Button>}
          {(service.status === 'in_progress' || service.status === 'assigned') && <Button onClick={() => setShowCompleteForm(true)}><CheckCircle className="mr-2 h-4 w-4" /> Complete</Button>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
          <CardContent>
            {customer && (
              <Link href={`/dashboard/customers/${customer.id}`} className="hover:underline">
                <p className="font-medium">{customer.full_name}</p>
                <p className="text-sm text-muted-foreground">{customer.customer_code} | {customer.phone}</p>
                <p className="text-sm text-muted-foreground mt-1">{customer.address_line1}, {customer.city}</p>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> <span>{formatDate(service.scheduled_date)}</span></div>
            {service.scheduled_time_slot && <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> <span>{service.scheduled_time_slot}</span></div>}
            {service.completed_date && <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> <span>Completed: {formatDate(service.completed_date)}</span></div>}
          </CardContent>
        </Card>
      </div>

      {/* AMC Contract Link */}
      {amcContract && (
        <Card>
          <CardHeader><CardTitle className="text-base">AMC Contract</CardTitle></CardHeader>
          <CardContent>
            <Link href={`/dashboard/amc/${amcContract.id}`} className="hover:underline">
              <p className="font-medium">{amcContract.contract_number}</p>
              <Badge variant="outline" className={getStatusColor(amcContract.status)}>{amcContract.status}</Badge>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Amount & Payment */}
      <Card>
        <CardHeader><CardTitle className="text-base">Billing</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-sm text-muted-foreground">Estimated</p><p className="text-lg font-bold">{formatCurrency(service.estimated_amount || 0)}</p></div>
            <div><p className="text-sm text-muted-foreground">Actual</p><p className="text-lg font-bold">{formatCurrency(service.actual_amount || 0)}</p></div>
            <div><p className="text-sm text-muted-foreground">Payment</p><Badge className={getStatusColor(service.payment_status)}>{PAYMENT_STATUS_LABELS[service.payment_status as keyof typeof PAYMENT_STATUS_LABELS] || service.payment_status}</Badge></div>
          </div>
        </CardContent>
      </Card>

      {/* Description & Notes */}
      {(service.description || service.work_done || service.notes) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {service.description && <div><p className="text-sm font-medium">Description</p><p className="text-sm text-muted-foreground">{service.description}</p></div>}
            {service.work_done && <div><p className="text-sm font-medium">Work Done</p><p className="text-sm text-muted-foreground">{service.work_done}</p></div>}
            {service.notes && <div><p className="text-sm font-medium">Notes</p><p className="text-sm text-muted-foreground">{service.notes}</p></div>}
          </CardContent>
        </Card>
      )}

      {/* Complete Service Form */}
      {showCompleteForm && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader><CardTitle className="text-base text-green-800">Complete Service</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Work Done *</Label>
              <Textarea value={completionData.work_done} onChange={(e) => setCompletionData((d) => ({ ...d, work_done: e.target.value }))} placeholder="Describe work performed..." />
            </div>
            <div className="space-y-2">
              <Label>Actual Amount (₹)</Label>
              <Input type="number" value={completionData.actual_amount} onChange={(e) => setCompletionData((d) => ({ ...d, actual_amount: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Parts Used (comma-separated)</Label>
              <Input value={completionData.parts_used} onChange={(e) => setCompletionData((d) => ({ ...d, parts_used: e.target.value }))} placeholder="Filter, Membrane, ..." />
            </div>
            <div className="flex gap-4">
              <Button onClick={handleCompleteService} disabled={completing || !completionData.work_done}>{completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark Complete</Button>
              <Button variant="outline" onClick={() => setShowCompleteForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
