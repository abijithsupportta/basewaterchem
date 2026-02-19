'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { serviceSchema } from '@/lib/validators';
import { useCustomers } from '@/hooks/use-customers';
import { TIME_SLOTS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';
import { notifyCustomer } from '@/lib/notify-client';
import type { ServiceFormData } from '@/types';
import { useUserRole } from '@/lib/use-user-role';

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
  const { customers, createCustomer } = useCustomers();

  // Quick-add customer state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCust, setNewCust] = useState({ full_name: '', phone: '', email: '', address_line1: '', city: '', district: '', state: 'Kerala', pincode: '' });

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

  const onSubmit = async (data: ServiceFormData) => {
    try {
      const supabase = createBrowserClient();
      const { data: newService, error } = await supabase.from('services').insert(data).select('service_number').single();
      if (error) throw error;

      // Send email notification to customer
      const selectedCustomer = customers.find((c) => c.id === data.customer_id);
      if (selectedCustomer?.email) {
        notifyCustomer('service_scheduled', {
          customerEmail: selectedCustomer.email,
          customerName: selectedCustomer.full_name,
          serviceNumber: newService?.service_number || 'New Service',
          serviceType: data.service_type === 'amc_service' ? 'Recurring Service' : data.service_type === 'installation' ? 'Installation' : 'Paid Service',
          scheduledDate: data.scheduled_date,
          description: data.description || '',
        });
      }

      toast.success('Service created successfully!');
      router.push('/dashboard/services');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create service');
    }
  };

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

  const serviceTypeOptions = [
    { value: 'amc_service', label: 'Recurring Service' },
    { value: 'paid_service', label: 'Paid Service' },
    { value: 'installation', label: 'Installation' },
  ];

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.full_name} (${c.customer_code})` }));
  const timeOptions = TIME_SLOTS.map((t) => ({ value: t, label: t }));

  const userRole = useUserRole();
  const createdByStaffId = 'current-staff-id'; // TODO: Replace with real user id

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

              <div className="space-y-2">
                <Label>Service Type *</Label>
                <SimpleSelect options={serviceTypeOptions} value={watch('service_type')} onChange={(v) => setValue('service_type', v as any)} />
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
