'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleSelect } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { staffSchema } from '@/lib/validators';
import { ROLE_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';
import type { StaffFormData } from '@/types';

export default function NewStaffPage() {
  const router = useRouter();
  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: { role: 'technician' },
  });

  const onSubmit = async (data: StaffFormData) => {
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('staff').insert(data);
      if (error) throw error;
      toast.success('Staff member added!');
      router.push('/dashboard/staff');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add staff');
    }
  };

  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">Add Staff Member</h1>
      <Card className="max-w-lg">
        <CardHeader><CardTitle>Staff Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2"><Label>Full Name *</Label><Input {...register('full_name')} />{errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}</div>
            <div className="space-y-2"><Label>Phone *</Label><Input {...register('phone')} />{errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}</div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" {...register('email')} /></div>
            <div className="space-y-2"><Label>Role *</Label><SimpleSelect options={roleOptions} value={watch('role')} onChange={(v) => setValue('role', v as any)} /></div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Staff</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
