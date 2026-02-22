import { NextRequest } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { canDelete, canManageStaff, type StaffRole } from '@/lib/authz';
import { apiSuccess, apiError } from '@/core/api';

const ALLOWED_STAFF_ROLES: StaffRole[] = ['admin', 'manager', 'staff', 'technician'];

async function getCurrentUserRole() {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { supabase, role: null as StaffRole | null, userId: null as string | null };
  }

  const metadataRole = userData.user.user_metadata?.role as StaffRole | undefined;
  if (metadataRole) {
    return { supabase, role: metadataRole, userId: userData.user.id };
  }

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();

  if (staffError || !staff?.role) {
    return { supabase, role: null as StaffRole | null, userId: userData.user.id };
  }
  return { supabase, role: staff.role as StaffRole, userId: userData.user.id };
}

export async function GET() {
  try {
    const { supabase, role } = await getCurrentUserRole();
    if (!role || !canManageStaff(role)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Only admin can view staff.' } },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('staff')
      .select(`
        id, 
        auth_user_id, 
        full_name, 
        email, 
        phone, 
        role, 
        is_active, 
        avatar_url, 
        branch_id,
        created_at, 
        updated_at,
        branch:branches(id, branch_name, branch_code)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { role } = await getCurrentUserRole();
    if (!role || !canManageStaff(role)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Only admin can add staff.' } },
        { status: 403 }
      );
    }

    const serviceSupabase = await createServiceRoleClient();

    const body = await request.json();
    const requestedRole = (body.role as StaffRole | undefined) ?? 'staff';
    if (!ALLOWED_STAFF_ROLES.includes(requestedRole)) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid staff role.' } },
        { status: 400 }
      );
    }

    const payload = {
      full_name: body.full_name ?? body.name,
      email: body.email,
      phone: body.phone ?? null,
      role: requestedRole,
      branch_id: body.branch_id ?? null,
      is_active: body.is_active ?? true,
    };

    const tempPassword = body.password || `Temp@${Math.random().toString(36).slice(-8)}A1`;

    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email: payload.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: payload.full_name,
        role: payload.role,
      },
    });

    if (authError || !authData.user) {
      return Response.json(
        { success: false, error: { code: 'AUTH_CREATE_FAILED', message: authError?.message || 'Failed to create auth user.' } },
        { status: 400 }
      );
    }

    const insertPayload = {
      ...payload,
      auth_user_id: authData.user.id,
    };

    const { data, error } = await serviceSupabase.from('staff').insert(insertPayload).select('*').single();
    if (error) {
      await serviceSupabase.auth.admin.deleteUser(authData.user.id);
      throw error;
    }

    return apiSuccess(data, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { role, userId } = await getCurrentUserRole();
    if (!role || !canManageStaff(role)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Only admin can update staff status.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const id = body.id as string | undefined;
    const isActive = body.is_active as boolean | undefined;

    if (!id || typeof isActive !== 'boolean') {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Staff id and is_active are required.' } },
        { status: 400 }
      );
    }

    const serviceSupabase = await createServiceRoleClient();
    const { data: existing, error: existingError } = await serviceSupabase
      .from('staff')
      .select('id, auth_user_id')
      .eq('id', id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Staff not found.' } },
        { status: 404 }
      );
    }

    if (existing.auth_user_id && existing.auth_user_id === userId && !isActive) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'You cannot deactivate your own account.' } },
        { status: 400 }
      );
    }

    const { data, error } = await serviceSupabase
      .from('staff')
      .update({ is_active: isActive })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    if (existing.auth_user_id) {
      await serviceSupabase.auth.admin.updateUserById(existing.auth_user_id, {
        user_metadata: {
          is_active: isActive,
        },
      });
    }

    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { role, userId } = await getCurrentUserRole();
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

    const serviceSupabase = await createServiceRoleClient();

    const { data: existing, error: existingError } = await serviceSupabase
      .from('staff')
      .select('id, auth_user_id')
      .eq('id', id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Staff not found.' } },
        { status: 404 }
      );
    }

    if (existing.auth_user_id && existing.auth_user_id === userId) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'You cannot delete your own account.' } },
        { status: 400 }
      );
    }

    await serviceSupabase.from('services').update({ assigned_technician_id: null }).eq('assigned_technician_id', id);
    await serviceSupabase.from('services').update({ created_by_staff_id: null }).eq('created_by_staff_id', id);
    await serviceSupabase.from('invoices').update({ created_by_staff_id: null }).eq('created_by_staff_id', id);

    const { error } = await serviceSupabase.from('staff').delete().eq('id', id);
    if (error) throw error;

    if (existing.auth_user_id) {
      const { error: authDeleteError } = await serviceSupabase.auth.admin.deleteUser(existing.auth_user_id);
      if (authDeleteError) {
        return Response.json(
          {
            success: false,
            error: {
              code: 'AUTH_DELETE_FAILED',
              message: `Staff DB record deleted but auth delete failed: ${authDeleteError.message}`,
            },
          },
          { status: 500 }
        );
      }
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
