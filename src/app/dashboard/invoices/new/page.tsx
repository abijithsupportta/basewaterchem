'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loading } from '@/components/ui/loading';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { invoiceSchema } from '@/lib/validators';
import { useCustomers } from '@/hooks/use-customers';
import { formatCurrency } from '@/lib/utils';
import { DEFAULT_TAX_PERCENT } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function NewInvoicePage() {
  return <Suspense fallback={<Loading />}><NewInvoiceContent /></Suspense>;
}

function NewInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomer = searchParams.get('customer') || '';
  const { customers, createCustomer } = useCustomers();

  // Quick-add customer state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCust, setNewCust] = useState({ full_name: '', phone: '', email: '', address_line1: '', city: '', district: '', state: 'Kerala', pincode: '' });

  const {
    register, handleSubmit, setValue, watch, control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: preselectedCustomer,
      invoice_date: new Date().toISOString().split('T')[0],
      tax_percent: DEFAULT_TAX_PERCENT,
      discount_amount: 0,
      notes: '',
      amc_enabled: false,
      amc_period_months: 3,
      items: [{ item_name: '', description: '', quantity: 1, unit_price: 0 }],
    },
  });

  // Set preselected customer when customers load
  useEffect(() => {
    if (preselectedCustomer && customers.length > 0) {
      setValue('customer_id', preselectedCustomer);
    }
  }, [preselectedCustomer, customers, setValue]);

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const items = watch('items') || [];
  const taxPercent = watch('tax_percent') || 0;
  const discountAmount = watch('discount_amount') || 0;
  const amcEnabled = watch('amc_enabled');
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
  const taxAmount = (subtotal * taxPercent) / 100;
  const total = subtotal + taxAmount - discountAmount;

  const onSubmit = async (data: any) => {
    try {
      const supabase = createBrowserClient();
      const { items: itemsData, amc_enabled, amc_period_months, ...invoiceData } = data;

      // Create the invoice
      const { data: invoice, error } = await supabase.from('invoices').insert({
        ...invoiceData,
        subtotal,
        tax_amount: taxAmount,
        total_amount: total,
        balance_due: total,
        amc_enabled: amc_enabled || false,
        amc_period_months: amc_enabled ? amc_period_months : null,
      }).select().single();
      if (error) throw error;

      // Create invoice items
      if (itemsData.length > 0) {
        const itemsToInsert = itemsData.map((item: any, idx: number) => ({
          invoice_id: invoice.id,
          item_name: item.item_name || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          sort_order: idx,
        }));
        await supabase.from('invoice_items').insert(itemsToInsert);
      }

      // If AMC enabled, create AMC contract and schedule first service
      if (amc_enabled && amc_period_months) {
        const invoiceDate = new Date(invoiceData.invoice_date || new Date());
        const firstServiceDate = new Date(invoiceDate);
        firstServiceDate.setMonth(firstServiceDate.getMonth() + amc_period_months);

        // Create AMC contract with next_service_date
        const { data: amcContract, error: amcError } = await supabase.from('amc_contracts').insert({
          customer_id: invoiceData.customer_id,
          invoice_id: invoice.id,
          start_date: invoiceDate.toISOString().split('T')[0],
          end_date: firstServiceDate.toISOString().split('T')[0],
          service_interval_months: amc_period_months,
          total_services_included: 1,
          services_completed: 0,
          amount: total,
          is_paid: false,
          status: 'active',
          next_service_date: firstServiceDate.toISOString().split('T')[0],
        }).select().single();
        if (amcError) throw amcError;

        // Create scheduled AMC service at first service date
        const { error: srvError } = await supabase.from('services').insert({
          customer_id: invoiceData.customer_id,
          amc_contract_id: amcContract.id,
          service_type: 'amc_service',
          status: 'scheduled',
          scheduled_date: firstServiceDate.toISOString().split('T')[0],
          description: `AMC service - Invoice ${invoice.invoice_number || 'N/A'}`,
          is_under_amc: true,
          payment_status: 'not_applicable',
        });
        if (srvError) throw srvError;
      }

      toast.success(amc_enabled ? 'Invoice created with recurring service!' : 'Invoice created!');
      router.push(`/dashboard/invoices/${invoice.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invoice');
    }
  };

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.full_name} (${c.customer_code})` }));
  const amcPeriodOptions = [
    { value: '3', label: '3 Months' },
    { value: '4', label: '4 Months' },
    { value: '6', label: '6 Months' },
    { value: '12', label: '12 Months' },
  ];

  const handleAddCustomer = async () => {
    if (!newCust.full_name || !newCust.phone || !newCust.address_line1) {
      toast.error('Name, phone, and address are required');
      return;
    }
    setAddingCustomer(true);
    try {
      const created = await createCustomer({
        full_name: newCust.full_name,
        phone: newCust.phone.startsWith('+91') ? newCust.phone : `+91${newCust.phone.replace(/^0+/, '')}`,
        email: newCust.email || undefined,
        address_line1: newCust.address_line1,
        city: newCust.city || undefined,
        district: newCust.district || undefined,
        state: newCust.state || 'Kerala',
        pincode: newCust.pincode || undefined,
      });
      setValue('customer_id', created.id);
      setShowAddCustomer(false);
      setNewCust({ full_name: '', phone: '', email: '', address_line1: '', city: '', district: '', state: 'Kerala', pincode: '' });
      toast.success(`Customer "${created.full_name}" added!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add customer');
    } finally {
      setAddingCustomer(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">New Invoice</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="max-w-3xl">
          <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Customer *</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowAddCustomer(!showAddCustomer)}>
                    <UserPlus className="mr-1 h-3 w-3" /> {showAddCustomer ? 'Cancel' : 'Add New Customer'}
                  </Button>
                </div>
                {!showAddCustomer && (
                  <>
                    <SearchableSelect options={customerOptions} value={watch('customer_id')} onChange={(v) => setValue('customer_id', v)} placeholder="Select customer..." searchPlaceholder="Search by name or code..." />
                    {errors.customer_id && <p className="text-sm text-destructive">{errors.customer_id.message}</p>}
                  </>
                )}
              </div>

              {/* Quick-add customer form */}
              {showAddCustomer && (
                <div className="sm:col-span-2 border rounded-lg p-4 bg-blue-50/50 space-y-3">
                  <p className="text-sm font-medium text-blue-800">New Customer</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Full Name *</Label>
                      <Input value={newCust.full_name} onChange={(e) => setNewCust((c) => ({ ...c, full_name: e.target.value }))} placeholder="Customer name" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone Number *</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-sm text-muted-foreground">+91</span>
                        <Input className="rounded-l-none" value={newCust.phone} onChange={(e) => setNewCust((c) => ({ ...c, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="9876543210" maxLength={10} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input type="email" value={newCust.email} onChange={(e) => setNewCust((c) => ({ ...c, email: e.target.value }))} placeholder="email@example.com" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Address *</Label>
                      <Input value={newCust.address_line1} onChange={(e) => setNewCust((c) => ({ ...c, address_line1: e.target.value }))} placeholder="Street address" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">City</Label>
                      <Input value={newCust.city} onChange={(e) => setNewCust((c) => ({ ...c, city: e.target.value }))} placeholder="City" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">District</Label>
                      <Input value={newCust.district} onChange={(e) => setNewCust((c) => ({ ...c, district: e.target.value }))} placeholder="District" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">State</Label>
                      <Input value={newCust.state} onChange={(e) => setNewCust((c) => ({ ...c, state: e.target.value }))} placeholder="State" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Pincode</Label>
                      <Input value={newCust.pincode} onChange={(e) => setNewCust((c) => ({ ...c, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="686001" maxLength={6} />
                    </div>
                  </div>
                  <Button type="button" size="sm" onClick={handleAddCustomer} disabled={addingCustomer}>
                    {addingCustomer && <Loader2 className="mr-2 h-3 w-3 animate-spin" />} Save & Select Customer
                  </Button>
                </div>
              )}

              <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" {...register('invoice_date')} /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea {...register('notes')} placeholder="Payment terms, notes..." /></div>
          </CardContent>
        </Card>

        {/* Recurring Service Section */}
        <Card className="max-w-3xl border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('amc_enabled')} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span>Schedule Recurring Service</span>
              </label>
            </CardTitle>
          </CardHeader>
          {amcEnabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Service Interval *</Label>
                <SimpleSelect
                  options={amcPeriodOptions}
                  value={String(watch('amc_period_months') || 3)}
                  onChange={(v) => setValue('amc_period_months', Number(v))}
                  placeholder="Select period..."
                />
              </div>
              <p className="text-sm text-muted-foreground">
                A recurring service will be scheduled {watch('amc_period_months') || 3} months from the invoice date. After each service is completed, the next one is automatically scheduled.
              </p>
            </CardContent>
          )}
        </Card>

        <Card className="max-w-3xl">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => append({ item_name: '', description: '', quantity: 1, unit_price: 0 })}><Plus className="mr-1 h-3 w-3" /> Add</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3 space-y-1">{index === 0 && <Label className="text-xs">Item Name</Label>}<Input {...register(`items.${index}.item_name`)} placeholder="Item name" /></div>
                <div className="col-span-3 space-y-1">{index === 0 && <Label className="text-xs">Description</Label>}<Input {...register(`items.${index}.description`)} placeholder="Description" /></div>
                <div className="col-span-2 space-y-1">{index === 0 && <Label className="text-xs">Qty</Label>}<Input type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} /></div>
                <div className="col-span-2 space-y-1">{index === 0 && <Label className="text-xs">Unit Price</Label>}<Input type="number" {...register(`items.${index}.unit_price`, { valueAsNumber: true })} /></div>
                <div className="col-span-1 text-right text-sm font-medium pt-1">{formatCurrency((items[index]?.quantity || 0) * (items[index]?.unit_price || 0))}</div>
                <div className="col-span-1">{fields.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div>
              </div>
            ))}
            <div className="border-t pt-4 space-y-2 text-right">
              <p className="text-sm">Subtotal: <span className="font-medium">{formatCurrency(subtotal)}</span></p>
              <div className="flex items-center justify-end gap-2">
                <Label className="text-sm">Tax %:</Label>
                <Input type="number" className="w-20 text-right" {...register('tax_percent', { valueAsNumber: true })} />
                <span className="text-sm font-medium w-24">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Label className="text-sm">Discount:</Label>
                <Input type="number" className="w-20 text-right" {...register('discount_amount', { valueAsNumber: true })} />
              </div>
              <p className="text-lg font-bold border-t pt-2">Total: {formatCurrency(total)}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 max-w-3xl">
          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Invoice</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
