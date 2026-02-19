'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { customerSchema } from '@/lib/validators';
import { createBrowserClient } from '@/lib/supabase/client';
import type { CustomerFormData } from '@/types';

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({ resolver: zodResolver(customerSchema) });

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    supabase.from('customers').select('*').eq('id', id).single().then(({ data }) => {
      if (data) reset(data);
      setLoading(false);
    });
  }, [id, reset]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('customers').update(data).eq('id', id);
      if (error) throw error;
      toast.success('Customer updated successfully!');
      router.push(`/dashboard/customers/${id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update customer');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div><h1 className="text-2xl font-bold">Edit Customer</h1></div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input id="full_name" {...register('full_name')} />
                {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
              </div>
              <div className="space-y-2"><Label htmlFor="phone">Phone *</Label><Input id="phone" {...register('phone')} />{errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}</div>
              <div className="space-y-2"><Label htmlFor="alt_phone">Alt Phone</Label><Input id="alt_phone" {...register('alt_phone')} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" {...register('email')} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="address_line1">Address *</Label><Input id="address_line1" {...register('address_line1')} />{errors.address_line1 && <p className="text-sm text-destructive">{errors.address_line1.message}</p>}</div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="address_line2">Address Line 2</Label><Input id="address_line2" {...register('address_line2')} /></div>
              <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" {...register('city')} /></div>
              <div className="space-y-2"><Label htmlFor="district">District</Label><Input id="district" {...register('district')} /></div>
              <div className="space-y-2"><Label htmlFor="state">State</Label><Input id="state" {...register('state')} /></div>
              <div className="space-y-2"><Label htmlFor="pincode">Pincode</Label><Input id="pincode" {...register('pincode')} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="location_landmark">Landmark</Label><Input id="location_landmark" {...register('location_landmark')} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" {...register('notes')} /></div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update Customer</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
