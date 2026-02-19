import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { canDelete, canManageStaff, type StaffRole } from '@/lib/authz';
import { apiSuccess, apiError } from '@/core/api';

async function getCurrentUserRole() {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { supabase, role: null as StaffRole | null };

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();

  if (staffError || !staff?.role) return { supabase, role: null as StaffRole | null };
  return { supabase, role: staff.role as StaffRole };
}

export async function GET() {
  try {
    const { supabase, role } = await getCurrentUserRole();
    if (!role || !canManageStaff(role)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Only admin/manager can view staff.' } },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('staff')
      .select('id, auth_user_id, full_name, email, phone, role, is_active, avatar_url, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, role } = await getCurrentUserRole();
    if (!role || !canManageStaff(role)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Only admin/manager can add staff.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const payload = {
      full_name: body.full_name ?? body.name,
      email: body.email,
      phone: body.phone ?? null,
      role: body.role ?? 'staff',
      is_active: body.is_active ?? true,
    };

    const { data, error } = await supabase.from('staff').insert(payload).select('*').single();
    if (error) throw error;
    return apiSuccess(data, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, role } = await getCurrentUserRole();
    if (!role || !canDelete(role)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Only admin can delete staff.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const id = body.id as string | undefined;
    if (!id) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Staff id is required.' } },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) throw error;
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
