'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { quotationSchema } from '@/lib/validators';
import { useCustomers } from '@/hooks/use-customers';
import { formatCurrency } from '@/lib/utils';
import { DEFAULT_TAX_PERCENT } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function NewQuotationPage() {
  const router = useRouter();
  const { customers } = useCustomers();

  const {
    register, handleSubmit, setValue, watch, control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customer_id: '',
      tax_percent: DEFAULT_TAX_PERCENT,
      discount_amount: 0,
      notes: '',
      items: [{ description: '', quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const items = watch('items') || [];
  const taxPercent = watch('tax_percent') || 0;
  const discountAmount = watch('discount_amount') || 0;
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
  const taxAmount = (subtotal * taxPercent) / 100;
  const total = subtotal + taxAmount - discountAmount;

  const onSubmit = async (data: any) => {
    try {
      const supabase = createBrowserClient();
      const { items: itemsData, ...quotationData } = data;
      const { data: quotation, error } = await supabase.from('quotations').insert({
        ...quotationData,
        subtotal,
        tax_amount: taxAmount,
        total_amount: total,
      }).select().single();
      if (error) throw error;

      if (itemsData.length > 0) {
        const itemsToInsert = itemsData.map((item: any, idx: number) => ({
          quotation_id: quotation.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          sort_order: idx,
        }));
        await supabase.from('quotation_items').insert(itemsToInsert);
      }

      toast.success('Quotation created!');
      router.push(`/dashboard/quotations/${quotation.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create quotation');
    }
  };

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.full_name} (${c.customer_code})` }));

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">New Quotation</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="max-w-3xl">
          <CardHeader><CardTitle>Customer & Terms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <SimpleSelect options={customerOptions} value={watch('customer_id')} onChange={(v) => setValue('customer_id', v)} placeholder="Select customer..." />
              {errors.customer_id && <p className="text-sm text-destructive">{(errors.customer_id as any).message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Notes / Terms</Label>
              <Textarea {...register('notes')} placeholder="Additional notes, terms, validity..." />
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-3xl">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}>
              <Plus className="mr-1 h-3 w-3" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-1">
                  {index === 0 && <Label className="text-xs">Description</Label>}
                  <Input {...register(`items.${index}.description`)} placeholder="Item description" />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Qty</Label>}
                  <Input type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-3 space-y-1">
                  {index === 0 && <Label className="text-xs">Unit Price</Label>}
                  <Input type="number" {...register(`items.${index}.unit_price`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-1 text-right text-sm font-medium pt-1">
                  {formatCurrency((items[index]?.quantity || 0) * (items[index]?.unit_price || 0))}
                </div>
                <div className="col-span-1">
                  {fields.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </div>
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
          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Quotation</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
