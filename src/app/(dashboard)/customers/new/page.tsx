'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { customerSchema } from '@/lib/validators';
import { useCustomers } from '@/hooks/use-customers';
import type { CustomerFormData } from '@/types';

export default function NewCustomerPage() {
  const router = useRouter();
  const { createCustomer } = useCustomers();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      city: 'Kottayam',
      district: 'Kottayam',
      state: 'Kerala',
    },
  });

  const onSubmit = async (data: CustomerFormData) => {
    try {
      await createCustomer(data);
      toast.success('Customer created successfully!');
      router.push('/dashboard/customers');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create customer');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div>
        <h1 className="text-2xl font-bold">New Customer</h1>
        <p className="text-muted-foreground">Add a new customer to the system</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input id="full_name" {...register('full_name')} placeholder="Customer full name" />
                {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" {...register('phone')} placeholder="10-digit phone number" />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="alt_phone">Alt Phone</Label>
                <Input id="alt_phone" {...register('alt_phone')} placeholder="Alternative number" />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} placeholder="customer@example.com" />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address_line1">Address *</Label>
                <Input id="address_line1" {...register('address_line1')} placeholder="House/Building, Street" />
                {errors.address_line1 && <p className="text-sm text-destructive">{errors.address_line1.message}</p>}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input id="address_line2" {...register('address_line2')} placeholder="Area, Locality" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input id="district" {...register('district')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register('state')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" {...register('pincode')} placeholder="686001" />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="location_landmark">Landmark</Label>
                <Input id="location_landmark" {...register('location_landmark')} placeholder="Near..." />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" {...register('notes')} placeholder="Additional notes..." />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Customer
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
