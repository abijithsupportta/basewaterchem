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
import { serviceSchema } from '@/lib/validators';
import { useCustomers } from '@/hooks/use-customers';
import { useStaff } from '@/hooks/use-staff';
import { TIME_SLOTS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';
import type { ServiceFormData } from '@/types';

export default function NewServicePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <NewServicePageContent />
    </Suspense>
  );
}

function NewServicePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomer = searchParams.get('customer');
  const { customers } = useCustomers();
  const { staff: technicians } = useStaff('technician');
  const [customerProducts, setCustomerProducts] = useState<any[]>([]);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      service_type: 'paid_service',
      customer_id: preselectedCustomer || '',
      scheduled_date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedCustomer = watch('customer_id');

  useEffect(() => {
    if (!selectedCustomer) return;
    const supabase = createBrowserClient();
    supabase.from('customer_products').select('*, product:products(name)').eq('customer_id', selectedCustomer).then(({ data }) => {
      if (data) setCustomerProducts(data);
    });
  }, [selectedCustomer]);

  const onSubmit = async (data: ServiceFormData) => {
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('services').insert(data);
      if (error) throw error;
      toast.success('Service created successfully!');
      router.push('/dashboard/services');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create service');
    }
  };

  const serviceTypeOptions = [
    { value: 'amc_service', label: 'AMC Service' },
    { value: 'paid_service', label: 'Paid Service' },
    { value: 'installation', label: 'Installation' },
    { value: 'complaint_service', label: 'Complaint Service' },
    { value: 'warranty_service', label: 'Warranty Service' },
  ];

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.full_name} (${c.customer_code})` }));
  const techOptions = technicians.map((t: any) => ({ value: t.id, label: t.full_name }));
  const cpOptions = customerProducts.map((cp: any) => ({ value: cp.id, label: cp.product?.name || 'Product' }));
  const timeOptions = TIME_SLOTS.map((t) => ({ value: t, label: t }));

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">New Service</h1>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Service Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Customer *</Label>
                <SimpleSelect options={customerOptions} value={watch('customer_id')} onChange={(v) => setValue('customer_id', v)} placeholder="Select customer..." />
                {errors.customer_id && <p className="text-sm text-destructive">{errors.customer_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Service Type *</Label>
                <SimpleSelect options={serviceTypeOptions} value={watch('service_type')} onChange={(v) => setValue('service_type', v as any)} />
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <SimpleSelect options={cpOptions} value={watch('customer_product_id') || ''} onChange={(v) => setValue('customer_product_id', v)} placeholder="Select product..." />
              </div>
              <div className="space-y-2">
                <Label>Scheduled Date *</Label>
                <Input type="date" {...register('scheduled_date')} />
                {errors.scheduled_date && <p className="text-sm text-destructive">{errors.scheduled_date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <SimpleSelect options={timeOptions} value={watch('scheduled_time_slot') || ''} onChange={(v) => setValue('scheduled_time_slot', v)} placeholder="Select time..." />
              </div>
              <div className="space-y-2">
                <Label>Assign Technician</Label>
                <SimpleSelect options={techOptions} value={watch('assigned_technician_id') || ''} onChange={(v) => setValue('assigned_technician_id', v)} placeholder="Select technician..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea {...register('description')} placeholder="Service details..." />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Service</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
