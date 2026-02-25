'use client';

import { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loading } from '@/components/ui/loading';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, Package, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { invoiceSchema } from '@/lib/validators';
import { useCustomers } from '@/hooks/use-customers';
import { useBranches } from '@/hooks/use-branches';
import { formatCurrency } from '@/lib/utils';
import { DEFAULT_TAX_PERCENT } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';
import { InventoryProduct } from '@/types/inventory';
import {
  applyStockDeltas,
  buildStockDeltas,
  getCurrentStaffId,
  normalizeIntegerQuantity,
  normalizeStockLines,
  validateStockAvailabilityForDeltas,
} from '@/lib/stock-ledger';

// Export default to match page component pattern
export default function EditInvoicePage() {
  return <Suspense fallback={<Loading />}><EditInvoiceContent /></Suspense>;
}

function EditInvoiceContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { customers, createCustomer } = useCustomers();
  const { branches } = useBranches();
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
  const [itemSourceTypes, setItemSourceTypes] = useState<('manual' | 'stock')[]>(['manual']);
  const [existingInvoice, setExistingInvoice] = useState<{ amountPaid: number; status: string }>({ amountPaid: 0, status: 'draft' });
  const [loading, setLoading] = useState(true);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCust, setNewCust] = useState({
    full_name: '',
    phone: '',
    email: '',
    address_line1: '',
    city: '',
    district: '',
    state: 'Kerala',
    pincode: '',
  });

  const {
    register, handleSubmit, setValue, watch, control, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: '',
      branch_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      tax_percent: DEFAULT_TAX_PERCENT,
      discount_amount: 0,
      notes: '',
      amc_enabled: false,
      amc_period_months: 3,
      items: [{ item_name: '', description: '', quantity: 1, unit_price: 0, inventory_product_id: null }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items') || [];

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

      return next.length ? next : ['manual'];
    });
  }, [items]);

  // Fetch inventory and invoice data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch inventory products
        const res = await fetch('/api/inventory/products?active_only=true');
        if (res.ok) {
          const data = await res.json();
          setInventoryProducts(data);
        }

        // Fetch invoice and items
        if (id) {
          const supabase = createBrowserClient();
          const [invRes, itemRes] = await Promise.all([
            supabase.from('invoices').select('*').eq('id', id).single(),
            supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
          ]);

          if (invRes.data) {
            const inv = invRes.data;
            const loadedItems = itemRes.data?.map((item: any) => ({
              item_name: item.item_name || '',
              description: item.description || '',
              quantity: item.quantity,
              unit_price: item.unit_price,
              inventory_product_id: item.inventory_product_id || null,
            })) || [];

            setExistingInvoice({
              amountPaid: Number(inv.amount_paid || 0),
              status: String(inv.status || 'draft'),
            });

            reset({
              customer_id: inv.customer_id,
              branch_id: inv.branch_id,
              invoice_date: inv.invoice_date,
              tax_percent: inv.tax_percent || DEFAULT_TAX_PERCENT,
              discount_amount: inv.discount_amount || 0,
              notes: inv.notes || '',
              amc_enabled: Boolean(inv.amc_enabled),
              amc_period_months: inv.amc_period_months || 3,
              items: loadedItems.length > 0 ? loadedItems : [{ item_name: '', description: '', quantity: 1, unit_price: 0, inventory_product_id: null }],
            });

            // Set source types - if has inventory_product_id then 'stock', else 'manual'
            setItemSourceTypes(loadedItems.map((item: any) => item.inventory_product_id ? 'stock' : 'manual'));
          }
        }
      } catch (error) {
        console.error('Error loading invoice:', error);
        toast.error('Failed to load invoice');
        router.push('/dashboard/invoices');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, reset, router]);

  const handleAddItem = () => {
    append({ item_name: '', description: '', quantity: 1, unit_price: 0, inventory_product_id: null });
    setItemSourceTypes((prev) => [...prev, 'manual']);
  };

  const handleRemoveItem = (index: number) => {
    remove(index);
    setItemSourceTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSourceTypeChange = (index: number, type: 'manual' | 'stock') => {
    setItemSourceTypes((prev) => {
      const next = [...prev];
      next[index] = type;
      return next;
    });

    if (type === 'manual') {
      setValue(`items.${index}.inventory_product_id`, null);
      setValue(`items.${index}.item_name`, '');
      setValue(`items.${index}.description`, '');
      setValue(`items.${index}.unit_price`, 0);
    } else {
      setValue(`items.${index}.item_name`, '');
      setValue(`items.${index}.description`, '');
      setValue(`items.${index}.unit_price`, 0);
      setValue(`items.${index}.inventory_product_id`, null);
    }
  };

  const handleStockProductChange = (index: number, productId: string) => {
    const product = inventoryProducts.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.inventory_product_id`, productId as any);
      setValue(`items.${index}.item_name`, product.name);
      setValue(`items.${index}.description`, product.description || '');
      setValue(`items.${index}.unit_price`, product.unit_price);
    }
  };

  const taxPercent = watch('tax_percent') || 0;
  const discountAmount = watch('discount_amount') || 0;
  const amcEnabled = watch('amc_enabled');
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
  const taxAmount = (subtotal * taxPercent) / 100;
  const total = subtotal + taxAmount - discountAmount;

  const onSubmit = async (data: any) => {
    try {
      const supabase = createBrowserClient();
      const { items: itemsData, ...invoiceData } = data;

      const normalizedItems = (itemsData || []).map((item: any) => ({
        ...item,
        quantity: normalizeIntegerQuantity(item.quantity),
        unit_price: Math.max(0, Number(item.unit_price) || 0),
      }));

      const { data: previousItems, error: previousItemsError } = await supabase
        .from('invoice_items')
        .select('inventory_product_id, quantity')
        .eq('invoice_id', id);

      if (previousItemsError) {
        throw new Error(previousItemsError.message || 'Failed to load existing invoice items.');
      }

      const previousStockLines = normalizeStockLines(
        (previousItems || []).map((item: any) => ({
          productId: item.inventory_product_id,
          quantity: item.quantity,
          label: item.item_name,
        }))
      );

      const nextStockLines = normalizeStockLines(
        normalizedItems.map((item: any) => ({
          productId: item.inventory_product_id,
          quantity: item.quantity,
          label: item.item_name,
        }))
      );

      const stockDeltas = buildStockDeltas(previousStockLines, nextStockLines);
      await validateStockAvailabilityForDeltas(supabase, stockDeltas);

      const createdByStaffId = await getCurrentStaffId(supabase);

      await applyStockDeltas(supabase, {
        deltas: stockDeltas,
        referenceType: 'invoice',
        referenceId: id,
        referenceLabel: 'Stock adjusted via Invoice Update',
        createdBy: createdByStaffId,
      });

      const amountPaid = Math.max(0, existingInvoice.amountPaid || 0);
      const balanceDue = Math.max(0, total - amountPaid);
      const nextStatus = balanceDue <= 0
        ? 'paid'
        : amountPaid > 0
          ? 'partial'
          : existingInvoice.status;

      // Update invoice
      const { error: invError } = await supabase.from('invoices').update({
        ...invoiceData,
        subtotal,
        tax_amount: taxAmount,
        total_amount: total,
        amount_paid: Math.min(amountPaid, total),
        balance_due: balanceDue,
        status: nextStatus,
      }).eq('id', id);
      if (invError) throw invError;

      // Delete existing items
      await supabase.from('invoice_items').delete().eq('invoice_id', id);

      // Create new items
      if (normalizedItems.length > 0) {
        const itemsToInsert = normalizedItems.map((item: any, idx: number) => ({
          invoice_id: id,
          item_name: item.item_name || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          inventory_product_id: item.inventory_product_id || null,
          sort_order: idx,
        }));

        await supabase.from('invoice_items').insert(itemsToInsert);
      }

      toast.success('Invoice updated!');
      router.push(`/dashboard/invoices/${id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update invoice');
    }
  };

  if (loading) return <Loading />;

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
      <h1 className="text-2xl font-bold">Edit Invoice</h1>
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

              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input type="date" {...register('invoice_date')} />
              </div>

              <div className="space-y-2">
                <Label>Branch *</Label>
                <select
                  {...register('branch_id')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Select branch...</option>
                  {branches && branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                  ))}
                </select>
                {errors.branch_id && <p className="text-sm text-destructive">{errors.branch_id.message as string}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Additional Notes <span className="text-muted-foreground text-xs">(Optional)</span></Label>
              <Textarea {...register('notes')} placeholder="Payment terms, special instructions, etc. (optional)" rows={3} />
            </div>
          </CardContent>
        </Card>

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
            <Button type="button" size="sm" variant="outline" onClick={handleAddItem}><Plus className="mr-1 h-3 w-3" /> Add</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-3 border rounded-lg p-3 bg-muted/30">
                {(() => {
                  const sourceType: 'manual' | 'stock' =
                    itemSourceTypes[index] === 'stock' || Boolean(watch(`items.${index}.inventory_product_id`))
                      ? 'stock'
                      : 'manual';

                  return (
                    <>
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

                <div className="grid grid-cols-12 gap-2 items-end">
                  {sourceType === 'stock' ? (
                    <>
                      <div className="col-span-4 space-y-1">
                        {index === 0 && <Label className="text-xs">Select Product</Label>}
                        <SearchableSelect
                          options={inventoryProducts.map((product) => ({
                            value: product.id,
                            label: `${product.name} • Stock: ${product.stock_quantity} • ${formatCurrency(product.unit_price)}`,
                          }))}
                          value={watch(`items.${index}.inventory_product_id`) || ''}
                          onChange={(val) => handleStockProductChange(index, val)}
                          placeholder="Search products..."
                          searchPlaceholder="Type to search products..."
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        {index === 0 && <Label className="text-xs">Description <span className="text-muted-foreground">(Optional)</span></Label>}
                        <Input {...register(`items.${index}.description`)} placeholder="Additional notes (optional)" disabled={!watch(`items.${index}.inventory_product_id`)} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-3 space-y-1">
                        {index === 0 && <Label className="text-xs">Item Name</Label>}
                        <Input {...register(`items.${index}.item_name`)} placeholder="Item name" />
                      </div>
                      <div className="col-span-4 space-y-1">
                        {index === 0 && <Label className="text-xs">Description <span className="text-muted-foreground">(Optional)</span></Label>}
                        <Input {...register(`items.${index}.description`)} placeholder="Item details (optional)" />
                      </div>
                    </>
                  )}

                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">Qty</Label>}
                    <Input
                      type="number"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      max={
                        sourceType === 'stock' && watch(`items.${index}.inventory_product_id`)
                          ? inventoryProducts.find((p) => p.id === watch(`items.${index}.inventory_product_id`))?.stock_quantity
                          : undefined
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">Unit Price</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium pt-1">
                    {formatCurrency((items[index]?.quantity || 0) * (items[index]?.unit_price || 0))}
                  </div>
                  <div className="col-span-1">
                    {fields.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveItem(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                    </>
                  );
                })()}
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
          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update Invoice</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
