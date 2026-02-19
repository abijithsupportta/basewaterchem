'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { amcSchema } from '@/lib/validators';
import { useCustomers } from '@/hooks/use-customers';
import { useProducts } from '@/hooks/use-products';
import { createBrowserClient } from '@/lib/supabase/client';
import type { AmcFormData } from '@/types';

export default function NewAMCPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <NewAMCPageContent />
    </Suspense>
  );
}

function NewAMCPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomer = searchParams.get('customer');
  const { customers } = useCustomers();
  const { products } = useProducts();

  const today = new Date();
  const oneYearLater = new Date(today);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<AmcFormData>({
    resolver: zodResolver(amcSchema),
    defaultValues: {
      customer_id: preselectedCustomer || '',
      service_interval_months: 3,
      total_services_included: 4,
      start_date: today.toISOString().split('T')[0],
      end_date: oneYearLater.toISOString().split('T')[0],
      amount: 0,
    },
  });

  const onSubmit = async (data: AmcFormData) => {
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('amc_contracts').insert(data);
      if (error) throw error;
      toast.success('AMC contract created!');
      router.push('/dashboard/amc');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create AMC');
    }
  };

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.full_name} (${c.customer_code})` }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} (${p.brand || ''})` }));

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">New AMC Contract</h1>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Contract Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Customer *</Label>
                <SimpleSelect options={customerOptions} value={watch('customer_id')} onChange={(v) => setValue('customer_id', v)} placeholder="Select customer..." />
                {errors.customer_id && <p className="text-sm text-destructive">{errors.customer_id.message}</p>}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Product *</Label>
                <SimpleSelect options={productOptions} value={watch('customer_product_id') || ''} onChange={(v) => setValue('customer_product_id', v)} placeholder="Select product..." />
                {errors.customer_product_id && <p className="text-sm text-destructive">{errors.customer_product_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" {...register('start_date')} />
                {errors.start_date && <p className="text-sm text-destructive">{errors.start_date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input type="date" {...register('end_date')} />
                {errors.end_date && <p className="text-sm text-destructive">{errors.end_date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Service Interval (months) *</Label>
                <Input type="number" {...register('service_interval_months', { valueAsNumber: true })} />
                {errors.service_interval_months && <p className="text-sm text-destructive">{errors.service_interval_months.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Total Services Included *</Label>
                <Input type="number" {...register('total_services_included', { valueAsNumber: true })} />
                {errors.total_services_included && <p className="text-sm text-destructive">{errors.total_services_included.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Contract Amount (₹) *</Label>
                <Input type="number" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea {...register('notes')} placeholder="Contract terms, special conditions..." />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create AMC</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
