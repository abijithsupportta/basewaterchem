'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Calendar, Clock, Download, Loader2, Plus, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor, getEffectiveServiceStatus, isFreeServiceActive, getFreeServiceDaysLeft, getFreeServiceValidUntil } from '@/lib/utils';
import { DEFAULT_TAX_PERCENT, SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';
import { notifyCustomer } from '@/lib/notify-client';
import { useUserRole } from '@/lib/use-user-role';
import { downloadServicePDF } from '@/lib/service-pdf';
import { InventoryProduct } from '@/types/inventory';
import {
  applyStockLines,
  normalizeIntegerQuantity,
  normalizeStockLines,
  validateStockAvailabilityForLines,
} from '@/lib/stock-ledger';

interface CompletionItem {
  part_name: string;
  qty: number;
  unit_price: number;
  inventory_product_id?: string | null;
}

function isAutoCreatedService(service: any): boolean {
  return Boolean(service?.amc_contract_id) && !service?.created_by_staff_id;
}

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const userRole = useUserRole();
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
  const [itemSourceTypes, setItemSourceTypes] = useState<('manual' | 'stock')[]>([]);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Completion form state
  const [workDone, setWorkDone] = useState('');
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [applyTax, setApplyTax] = useState(false);
  const [taxPercent, setTaxPercent] = useState(DEFAULT_TAX_PERCENT);

  const partsCost = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  const taxAmount = applyTax ? ((partsCost + serviceCharge - discount) * taxPercent) / 100 : 0;
  const totalAmount = partsCost + serviceCharge + taxAmount - discount;

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { part_name: '', qty: 1, unit_price: 0, inventory_product_id: null }]);
    setItemSourceTypes((prev) => [...prev, 'manual']);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setItemSourceTypes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    setItemSourceTypes((prev) => {
      const next = [...prev];

      if (next.length > items.length) {
        next.length = items.length;
      }

      for (let i = 0; i < items.length; i++) {
        const hasStockProduct = Boolean(items[i]?.inventory_product_id);
        if (!next[i]) {
          next[i] = hasStockProduct ? 'stock' : 'manual';
        } else if (hasStockProduct && next[i] !== 'stock') {
          next[i] = 'stock';
        }
      }

      return next;
    });
  }, [items]);

  const updateItem = useCallback((index: number, field: keyof CompletionItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        if (field === 'qty') {
          const numericValue = Number(value);
          return { ...item, qty: Number.isFinite(numericValue) ? numericValue : 0 };
        }

        if (field === 'unit_price') {
          const numericValue = Number(value);
          return { ...item, unit_price: Number.isFinite(numericValue) ? numericValue : 0 };
        }

        return { ...item, [field]: value };
      })
    );
  }, []);

  const handleSourceTypeChange = (index: number, type: 'manual' | 'stock') => {
    const newTypes = [...itemSourceTypes];
    newTypes[index] = type;
    setItemSourceTypes(newTypes);

    // Reset item fields when switching
    const newItems = [...items];
    if (type === 'manual') {
      newItems[index] = { part_name: '', qty: 1, unit_price: 0, inventory_product_id: null };
    } else {
      newItems[index] = { part_name: '', qty: 1, unit_price: 0, inventory_product_id: null };
    }
    setItems(newItems);
  };

  const handleStockProductChange = (index: number, productId: string) => {
    const product = inventoryProducts.find((p) => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        part_name: product.name,
        qty: 1,
        unit_price: product.unit_price,
        inventory_product_id: productId,
      };
      setItems(newItems);
    }
  };

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    Promise.all([
      supabase
        .from('services')
        .select('*, customer:customers(*)')
        .eq('id', id)
        .single(),
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/inventory/products?active_only=true').then((r) => r.json()),
    ]).then(([serviceRes, settings, inventoryData]) => {
      if (serviceRes.data) setService(serviceRes.data);
      if (settings) setCompanySettings(settings);
      if (inventoryData) setInventoryProducts(inventoryData);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!service) return;
    setRescheduleDate(service.scheduled_date || '');
    setRescheduleTimeSlot(service.scheduled_time_slot || '');
  }, [service]);

  useEffect(() => {
    if (!service || !showCompleteForm) return;
    const existingTaxPercent = Number(service.tax_percent || 0);
    setApplyTax(existingTaxPercent > 0);
    setTaxPercent(existingTaxPercent > 0 ? existingTaxPercent : DEFAULT_TAX_PERCENT);
  }, [service, showCompleteForm]);

  const handleDownloadServicePdf = () => {
    if (!service) return;
    const customer = service.customer as any;
    downloadServicePDF(
      {
        ...service,
        customer: {
          full_name: customer?.full_name,
          phone: customer?.phone,
          email: customer?.email,
          address_line1: customer?.address_line1,
          city: customer?.city,
          state: customer?.state,
          pincode: customer?.pincode,
        },
      },
      companySettings
    );
  };

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
      const normalizedItems = items.map((item) => ({
        ...item,
        qty: normalizeIntegerQuantity(item.qty),
        unit_price: Math.max(0, Number(item.unit_price) || 0),
      }));

      const partsUsed = normalizedItems
        .filter((i) => i.part_name.trim() && i.qty > 0)
        .map((i) => ({
          part_name: i.part_name.trim(),
          qty: i.qty,
          cost: i.qty * i.unit_price,
          unit_price: i.unit_price,
          inventory_product_id: i.inventory_product_id || null,
        }));

      const stockLines = normalizeStockLines(
        normalizedItems.map((item) => ({
          productId: item.inventory_product_id,
          quantity: item.qty,
          label: item.part_name,
        }))
      );

      // Get staff details for tracking (parallel with service update preparation)
      const staffPromise = (async () => {
        let completedByStaffId: string | null = null;
        let completedByStaffName: string | null = null;
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('id, full_name')
            .eq('auth_user_id', authData.user.id)
            .maybeSingle();
          
          if (staffData) {
            completedByStaffId = staffData.id;
            completedByStaffName = staffData.full_name;
          }
        }
        return { completedByStaffId, completedByStaffName };
      })();

      // Get AMC and existing services data in parallel if needed
      const amcPromise = (async () => {
        if (service.service_type === 'amc_service' && service.amc_contract_id) {
          const [amcRes, existingRes] = await Promise.all([
            supabase.from('amc_contracts').select('*').eq('id', service.amc_contract_id).single(),
            supabase.from('services').select('id').eq('amc_contract_id', service.amc_contract_id)
              .in('status', ['scheduled', 'assigned']).neq('id', id),
          ]);
          return { amc: amcRes.data, existing: existingRes.data };
        }
        return null;
      })();

      // Wait for staff data
      const { completedByStaffId, completedByStaffName } = await staffPromise;

      if (stockLines.length > 0) {
        await validateStockAvailabilityForLines(supabase, stockLines);
        await applyStockLines(supabase, {
          lines: stockLines,
          transactionType: 'service',
          referenceType: 'service',
          referenceId: id,
          referenceLabel: `Used in Service ${service.service_number || id}`,
          createdBy: completedByStaffId,
        });
      }

      const updateData: any = {
        status: 'completed',
        completed_date: new Date().toISOString(),
        work_done: workDone,
        parts_used: partsUsed,
        parts_cost: partsCost,
        service_charge: serviceCharge,
        tax_percent: applyTax ? taxPercent : 0,
        tax_amount: applyTax ? taxAmount : 0,
        discount: discount,
        total_amount: Math.max(totalAmount, 0),
        completed_by_staff_id: completedByStaffId,
        completed_by_staff_name: completedByStaffName,
      };

      // Main service update
      const { error } = await supabase.from('services').update(updateData).eq('id', id);
      if (error) throw error;

      // Parallelize non-critical post-completion operations
      const backgroundOps = [];

      // 2. Handle AMC scheduling in background
      const amcOp = (async () => {
        const amcData = await amcPromise;
        if (!amcData) return;

        const { amc: amcContract, existing: existingServices } = amcData;

        if (amcContract && amcContract.status === 'active') {
          const intervalMonths = amcContract.service_interval_months || 3;
          const completedDate = new Date();
          completedDate.setHours(0, 0, 0, 0);
          const nextDate = new Date(completedDate);
          nextDate.setMonth(nextDate.getMonth() + intervalMonths);
          const nextDateStr = nextDate.toISOString().split('T')[0];
          
          if (!existingServices || existingServices.length === 0) {
            const freeValidUntil = amcContract.start_date ? new Date(amcContract.start_date) : null;
            if (freeValidUntil) {
              freeValidUntil.setDate(freeValidUntil.getDate() + 365);
            }

            // Parallelize AMC update and service creation
            await Promise.all([
              supabase.from('amc_contracts').update({
                services_completed: (amcContract.services_completed || 0) + 1,
                next_service_date: nextDateStr,
                end_date: nextDateStr,
              }).eq('id', service.amc_contract_id),
              supabase.from('services').insert({
                customer_id: service.customer_id,
                amc_contract_id: service.amc_contract_id,
                service_type: 'amc_service',
                status: 'scheduled',
                scheduled_date: nextDateStr,
                description: `AMC service - ${amcContract.contract_number || 'Recurring'}`,
                is_under_amc: true,
                payment_status: 'not_applicable',
                free_service_valid_until: freeValidUntil ? freeValidUntil.toISOString().split('T')[0] : null,
              }),
            ]);

            // Notify in background
            const custNext = service.customer as any;
            if (custNext?.email) {
              notifyCustomer('service_scheduled', {
                customerEmail: custNext.email,
                customerName: custNext.full_name,
                serviceNumber: `Next Service`,
                serviceType: SERVICE_TYPE_LABELS[service.service_type as keyof typeof SERVICE_TYPE_LABELS] || 'Service',
                scheduledDate: nextDateStr,
                description: `Recurring service - ${amcContract.contract_number || 'Scheduled'}`,
              }).catch(console.error);
            }
          } else {
            await supabase.from('amc_contracts').update({
              services_completed: (amcContract.services_completed || 0) + 1,
            }).eq('id', service.amc_contract_id);
          }
        }
      })();

      backgroundOps.push(amcOp);

      // 3. Send completion notification in background (don't await)
      const custComplete = service.customer as any;
      if (custComplete?.email) {
        notifyCustomer('service_completed', {
          customerEmail: custComplete.email,
          customerName: custComplete.full_name,
          serviceNumber: service.service_number || `SRV-${id?.toString().slice(0, 8)}`,
          serviceType: SERVICE_TYPE_LABELS[service.service_type as keyof typeof SERVICE_TYPE_LABELS] || 'Service',
          completedDate: updateData.completed_date,
          workDone: workDone,
          totalAmount: Math.max(totalAmount, 0),
        }).catch(console.error);
      }

      // Update UI immediately (don't wait for background ops)
      setService((s: any) => ({ ...s, ...updateData }));
      setShowCompleteForm(false);
      toast.success('Service completed!');

      // Process background operations without blocking
      Promise.all(backgroundOps).catch((err) => {
        console.error('Background operations error:', err);
      });

    } catch (error: any) {
      toast.error(error.message || 'Failed to complete');
    } finally {
      setCompleting(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate) {
      toast.error('Please select a date');
      return;
    }
    setRescheduling(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase
        .from('services')
        .update({
          scheduled_date: rescheduleDate,
          scheduled_time_slot: rescheduleTimeSlot || null,
        })
        .eq('id', id);
      if (error) throw error;
      setService((prev: any) => ({
        ...prev,
        scheduled_date: rescheduleDate,
        scheduled_time_slot: rescheduleTimeSlot || null,
      }));
      toast.success('Service rescheduled');
      setShowReschedule(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const handleDeleteService = async () => {
    if (userRole !== 'superadmin') {
      toast.error('Only superadmin can delete scheduled services');
      return;
    }
    const confirmed = window.confirm('Delete this scheduled service?');
    if (!confirmed) return;
    setDeleting(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      toast.success('Service deleted');
      router.push('/dashboard/services');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete service');
    } finally {
      setDeleting(false);
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

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{service.service_number}</h1>
            <p className="text-muted-foreground">
              {service.service_type === 'free_service' && !isFreeServiceActive(service)
                ? 'Paid Service'
                : SERVICE_TYPE_LABELS[service.service_type as keyof typeof SERVICE_TYPE_LABELS]}
            </p>
          </div>
          {isFreeServiceActive(service) && (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800">Free Service</Badge>
              {getFreeServiceValidUntil(service) && (
                <span className="text-xs text-muted-foreground">
                  {Math.max(0, getFreeServiceDaysLeft(service) ?? 0)} days left
                </span>
              )}
            </div>
          )}
          <Badge className={getStatusColor(getEffectiveServiceStatus(service.status, service.scheduled_date))}>{SERVICE_STATUS_LABELS[getEffectiveServiceStatus(service.status, service.scheduled_date) as keyof typeof SERVICE_STATUS_LABELS]}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadServicePdf}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          {userRole === 'superadmin' && (service.status === 'scheduled' || service.status === 'assigned') && (
            <Button variant="outline" onClick={() => setShowReschedule(true)}>
              <Calendar className="mr-2 h-4 w-4" /> Reschedule
            </Button>
          )}
          {userRole === 'superadmin' && service.status === 'scheduled' && (
            <Button variant="destructive" onClick={handleDeleteService} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          )}
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
            {service.assigned_technician_id && (
              <div className="text-sm text-muted-foreground">
                Assigned Technician: {service.technician_name || service.assigned_technician_id}
              </div>
            )}
            {!service.assigned_technician_id && userRole !== 'technician' && (
              <div className="text-sm text-muted-foreground">Technician not assigned</div>
            )}
            {service.completed_date && <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> <span>Completed: {formatDate(service.completed_date)}</span></div>}
          </CardContent>
        </Card>
      </div>

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
          {service.tax_amount > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              GST ({service.tax_percent || 0}%): {formatCurrency(service.tax_amount || 0)}
            </div>
          )}
          <div className="mt-3">
            <Badge className={getStatusColor(service.payment_status)}>{PAYMENT_STATUS_LABELS[service.payment_status as keyof typeof PAYMENT_STATUS_LABELS] || service.payment_status}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Service Record</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {isAutoCreatedService(service) && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creation Source</span>
              <Badge variant="outline" className="text-xs">Created Automatically</Badge>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created By</span>
            <span className="font-medium">{service.created_by_staff_name || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created On</span>
            <span>{service.created_at ? formatDate(service.created_at) : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Completed By</span>
            <span className="font-medium">{service.completed_by_staff_name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Completed On</span>
            <span>{service.completed_date ? formatDate(service.completed_date) : '-'}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Last Updated</span>
            <span>{service.updated_at ? formatDate(service.updated_at) : '-'}</span>
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

      {/* Complete Service Dialog */}
      <Dialog open={showCompleteForm} onOpenChange={setShowCompleteForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Complete Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
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
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="rounded-lg border p-3 bg-muted/30 space-y-2">
                      {(() => {
                        const sourceType: 'manual' | 'stock' =
                          itemSourceTypes[index] === 'stock' || Boolean(item.inventory_product_id)
                            ? 'stock'
                            : 'manual';

                        return (
                          <>
                      {/* Source Type Toggle */}
                      <div className="flex items-center gap-4 mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={sourceType === 'manual'}
                            onChange={() => handleSourceTypeChange(index, 'manual')}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Manual Entry</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={sourceType === 'stock'}
                            onChange={() => handleSourceTypeChange(index, 'stock')}
                            className="h-4 w-4"
                          />
                          <span className="text-sm flex items-center gap-1">
                            <Package className="h-4 w-4" /> From Stock
                          </span>
                        </label>
                        <Badge variant="outline" className="ml-auto h-5 px-2 text-[10px] leading-none">
                          {sourceType === 'stock' ? 'Stock' : 'Manual'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-[1fr_80px_100px_40px] gap-2 items-center">
                        {sourceType === 'stock' ? (
                          <SearchableSelect
                            options={inventoryProducts.map((product) => ({
                              value: product.id,
                              label: `${product.name} • Stock: ${product.stock_quantity} • ${formatCurrency(product.unit_price)}`,
                            }))}
                            value={item.inventory_product_id || ''}
                            onChange={(val) => handleStockProductChange(index, val)}
                            placeholder="Search products..."
                            searchPlaceholder="Type to search products..."
                          />
                        ) : (
                          <Input
                            placeholder="Part / Item name"
                            value={item.part_name}
                            onChange={(e) => updateItem(index, 'part_name', e.target.value)}
                          />
                        )}
                        <Input
                          type="number"
                          min={1}
                          max={
                            sourceType === 'stock' && item.inventory_product_id
                              ? inventoryProducts.find(p => p.id === item.inventory_product_id)?.stock_quantity
                              : undefined
                          }
                          value={item.qty}
                          onChange={(e) => updateItem(index, 'qty', Number(e.target.value))}
                          className="text-center"
                        />
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                          className="text-right"
                          placeholder="0.00"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-red-500 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Charges */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Service Charge (Rs)</Label>
                <Input type="number" min={0} value={serviceCharge} onChange={(e) => setServiceCharge(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Discount (Rs)</Label>
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                  />
                  Apply GST
                </Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!applyTax}
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Totals Summary */}
            <div className="rounded-md border bg-white p-4 space-y-1 text-sm">
              {items.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Parts / Items Cost</span><span>{formatCurrency(partsCost)}</span></div>}
              {serviceCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service Charge</span><span>{formatCurrency(serviceCharge)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>}
              {applyTax && <div className="flex justify-between"><span className="text-muted-foreground">GST ({taxPercent}%)</span><span>{formatCurrency(taxAmount)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Total</span><span>{formatCurrency(Math.max(totalAmount, 0))}</span></div>
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <Button onClick={handleCompleteService} disabled={completing || !workDone.trim()}>
                {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mark Complete
              </Button>
              <Button variant="outline" onClick={() => setShowCompleteForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time Slot</Label>
              <Input value={rescheduleTimeSlot} onChange={(e) => setRescheduleTimeSlot(e.target.value)} placeholder="Morning / Afternoon / Evening" />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleReschedule} disabled={rescheduling}>
                {rescheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowReschedule(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
