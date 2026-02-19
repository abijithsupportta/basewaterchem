'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Calendar, Clock, Loader2, Plus, Trash2 } from 'lucide-react';
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

interface CompletionItem {
  part_name: string;
  qty: number;
  unit_price: number;
}

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);

  // Completion form state
  const [workDone, setWorkDone] = useState('');
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [discount, setDiscount] = useState(0);

  const partsCost = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  const totalAmount = partsCost + serviceCharge - discount;

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { part_name: '', qty: 1, unit_price: 0 }]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback((index: number, field: keyof CompletionItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }, []);

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
      const partsUsed = items.filter((i) => i.part_name.trim()).map((i) => ({
        part_name: i.part_name.trim(),
        qty: i.qty,
        cost: i.qty * i.unit_price,
        unit_price: i.unit_price,
      }));

      const updateData: any = {
        status: 'completed',
        completed_date: new Date().toISOString(),
        work_done: workDone,
        parts_used: partsUsed,
        parts_cost: partsCost,
        service_charge: serviceCharge,
        discount: discount,
        total_amount: Math.max(totalAmount, 0),
      };
      const { error } = await supabase.from('services').update(updateData).eq('id', id);
      if (error) throw error;

      // If this is an AMC service, schedule the next one automatically
      if (service.service_type === 'amc_service' && service.amc_contract_id) {
        const { data: amcData } = await supabase.from('amc_contracts')
          .select('*')
          .eq('id', service.amc_contract_id)
          .single();

        if (amcData && amcData.status === 'active') {
          // Check if a scheduled/assigned service already exists for this AMC (prevent duplicates)
          const { data: existingServices } = await supabase.from('services')
            .select('id')
            .eq('amc_contract_id', service.amc_contract_id)
            .in('status', ['scheduled', 'assigned'])
            .neq('id', id);

          if (!existingServices || existingServices.length === 0) {
            const completedDate = new Date();
            const nextDate = new Date(completedDate);
            nextDate.setMonth(nextDate.getMonth() + (amcData.service_interval_months || 3));
            const nextDateStr = nextDate.toISOString().split('T')[0];

            // Update AMC contract: increment services_completed, set next_service_date, extend end_date
            await supabase.from('amc_contracts').update({
              services_completed: (amcData.services_completed || 0) + 1,
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
            // Just update services_completed count
            await supabase.from('amc_contracts').update({
              services_completed: (amcData.services_completed || 0) + 1,
            }).eq('id', service.amc_contract_id);
            toast.success('Service completed!');
          }
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
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div><p className="text-sm text-muted-foreground">Parts Cost</p><p className="text-lg font-bold">{formatCurrency(service.parts_cost || 0)}</p></div>
            <div><p className="text-sm text-muted-foreground">Service Charge</p><p className="text-lg font-bold">{formatCurrency(service.service_charge || 0)}</p></div>
            <div><p className="text-sm text-muted-foreground">Discount</p><p className="text-lg font-bold text-red-600">-{formatCurrency(service.discount || 0)}</p></div>
            <div><p className="text-sm text-muted-foreground">Total</p><p className="text-lg font-bold">{formatCurrency(service.total_amount || 0)}</p></div>
          </div>
          <div className="mt-3">
            <Badge className={getStatusColor(service.payment_status)}>{PAYMENT_STATUS_LABELS[service.payment_status as keyof typeof PAYMENT_STATUS_LABELS] || service.payment_status}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Parts Used */}
      {service.parts_used && Array.isArray(service.parts_used) && service.parts_used.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Items / Parts Used</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="pb-2">Item</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Unit Price</th><th className="pb-2 text-right">Amount</th></tr></thead>
              <tbody>
                {service.parts_used.map((p: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{p.part_name || p.name}</td>
                    <td className="py-2 text-center">{p.qty || 1}</td>
                    <td className="py-2 text-right">{formatCurrency(p.unit_price || p.cost || 0)}</td>
                    <td className="py-2 text-right">{formatCurrency((p.qty || 1) * (p.unit_price || p.cost || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

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
          <CardContent className="space-y-6">
            {/* Work Done */}
            <div className="space-y-2">
              <Label>Work Done *</Label>
              <Textarea value={workDone} onChange={(e) => setWorkDone(e.target.value)} placeholder="Describe work performed..." rows={3} />
            </div>

            {/* Items / Parts Used */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Items / Parts Used</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" /> Add Item
                </Button>
              </div>
              {items.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_80px_100px_40px] gap-2 text-xs font-medium text-muted-foreground">
                    <span>Item Name</span><span className="text-center">Qty</span><span className="text-right">Unit Price (₹)</span><span />
                  </div>
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_80px_100px_40px] gap-2 items-center">
                      <Input
                        placeholder="Part / Item name"
                        value={item.part_name}
                        onChange={(e) => updateItem(index, 'part_name', e.target.value)}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => updateItem(index, 'qty', Number(e.target.value))}
                        className="text-center"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                        className="text-right"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Charges */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Service Charge (₹)</Label>
                <Input type="number" min={0} value={serviceCharge} onChange={(e) => setServiceCharge(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Discount (₹)</Label>
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              </div>
            </div>

            {/* Totals Summary */}
            <div className="rounded-md border bg-white p-4 space-y-1 text-sm">
              {items.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Parts / Items Cost</span><span>{formatCurrency(partsCost)}</span></div>}
              {serviceCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service Charge</span><span>{formatCurrency(serviceCharge)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Total</span><span>{formatCurrency(Math.max(totalAmount, 0))}</span></div>
            </div>

            <div className="flex gap-4">
              <Button onClick={handleCompleteService} disabled={completing || !workDone.trim()}>{completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark Complete</Button>
              <Button variant="outline" onClick={() => setShowCompleteForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
