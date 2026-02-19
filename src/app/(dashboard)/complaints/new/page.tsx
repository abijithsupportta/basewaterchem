'use client';

import { useEffect, useState } from 'react';
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
import { complaintSchema } from '@/lib/validators';
import { useCustomers } from '@/hooks/use-customers';
import { createBrowserClient } from '@/lib/supabase/client';
import type { ComplaintFormData } from '@/types';

export default function NewComplaintPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomer = searchParams.get('customer');
  const { customers } = useCustomers();
  const [customerProducts, setCustomerProducts] = useState<any[]>([]);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<ComplaintFormData>({
    resolver: zodResolver(complaintSchema),
    defaultValues: { customer_id: preselectedCustomer || '', priority: 'medium' },
  });

  const selectedCustomer = watch('customer_id');

  useEffect(() => {
    if (!selectedCustomer) return;
    const supabase = createBrowserClient();
    supabase.from('customer_products').select('*, product:products(name)').eq('customer_id', selectedCustomer).then(({ data }) => {
      if (data) setCustomerProducts(data);
    });
  }, [selectedCustomer]);

  const onSubmit = async (data: ComplaintFormData) => {
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('complaints').insert(data);
      if (error) throw error;
      toast.success('Complaint registered!');
      router.push('/dashboard/complaints');
    } catch (error: any) {
      toast.error(error.message || 'Failed to register complaint');
    }
  };

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.full_name} (${c.customer_code})` }));
  const cpOptions = customerProducts.map((cp: any) => ({ value: cp.id, label: cp.product?.name || 'Product' }));
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">New Complaint</h1>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Complaint Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Customer *</Label>
                <SimpleSelect options={customerOptions} value={watch('customer_id')} onChange={(v) => setValue('customer_id', v)} placeholder="Select customer..." />
                {errors.customer_id && <p className="text-sm text-destructive">{errors.customer_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <SimpleSelect options={cpOptions} value={watch('customer_product_id') || ''} onChange={(v) => setValue('customer_product_id', v)} placeholder="Select product..." />
              </div>
              <div className="space-y-2">
                <Label>Priority *</Label>
                <SimpleSelect options={priorityOptions} value={watch('priority')} onChange={(v) => setValue('priority', v as any)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Subject *</Label>
                <Input {...register('title')} placeholder="Brief description of the complaint" />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description *</Label>
                <Textarea {...register('description')} placeholder="Detailed complaint description..." rows={4} />
                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Register Complaint</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
