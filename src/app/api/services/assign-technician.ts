import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { canAssignTechnician, type StaffRole } from '@/lib/authz';
import { apiError, apiSuccess } from '@/core/api';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');

    if (!canAssignTechnician(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only admin/manager/staff can assign technician.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const serviceId = body.service_id as string | undefined;
    const technicianId = body.technician_id as string | undefined;

    if (!serviceId || !technicianId) {
      return NextResponse.json(
        { error: 'service_id and technician_id are required.' },
        { status: 400 }
      );
    }

    const { data: technician, error: techError } = await supabase
      .from('staff')
      .select('id, role, is_active')
      .eq('id', technicianId)
      .maybeSingle();

    if (techError) throw techError;
    if (!technician || technician.role !== 'technician' || !technician.is_active) {
      return NextResponse.json({ error: 'Technician not found.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('services')
      .update({ assigned_technician_id: technicianId, status: 'assigned' })
      .eq('id', serviceId)
      .select('*')
      .single();

    if (error) throw error;
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
