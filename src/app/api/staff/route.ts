import { NextRequest } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { emailService } from '@/domain/services';
import { canDelete, canManageStaff, type StaffRole } from '@/lib/authz';
import { apiSuccess, apiError } from '@/core/api';

// Only allow adding these roles (no admin or superadmin)
const ALLOWED_STAFF_ROLES: StaffRole[] = ['manager', 'staff', 'technician'];

async function getCurrentUserRole() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.log('[Staff API] No user found:', userError?.message);
      return { supabase, role: null as StaffRole | null, userId: null as string | null };
    }

    const metadataRole = userData.user.user_metadata?.role as StaffRole | undefined;
    if (metadataRole) {
      console.log('[Staff API] Using metadata role:', metadataRole);
      return { supabase, role: metadataRole, userId: userData.user.id };
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();

    if (staffError) {
      console.error('[Staff API] Staff lookup error:', staffError);
      return { supabase, role: null as StaffRole | null, userId: userData.user.id };
    }

    if (!staff?.role) {
      console.log('[Staff API] No staff record found for user:', userData.user.id);
      return { supabase, role: null as StaffRole | null, userId: userData.user.id };
    }

    console.log('[Staff API] User role:', staff.role);
    return { supabase, role: staff.role as StaffRole, userId: userData.user.id };
  } catch (error) {
    console.error('[Staff API] Unexpected error in getCurrentUserRole:', error);
    throw error;
  }
}

async function logEmailFailure(params: {
  serviceSupabase: ReturnType<typeof createServiceRoleClient>;
  recipientEmail: string;
  emailType: string;
  payload: Record<string, unknown>;
  errorMessage: string;
}) {
  try {
    const { serviceSupabase, recipientEmail, emailType, payload, errorMessage } = params;
    await serviceSupabase.from('email_delivery_logs').insert({
      recipient_email: recipientEmail,
      email_type: emailType,
      payload,
      status: 'failed',
      error_message: errorMessage,
    });
  } catch (error) {
    console.error('[Staff API] Failed to log email error:', error);
  }
}

export async function GET() {
  try {
    const { supabase, role } = await getCurrentUserRole();
    if (!role || !canManageStaff(role)) {
      console.log('[Staff API GET] Access denied for role:', role);
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Admin or Manager can view staff.' } },
        { status: 403 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'SERVER_MISCONFIGURED',
            message: 'Server is missing SUPABASE_SERVICE_ROLE_KEY. Staff listing requires service role access.',
          },
        },
        { status: 500 }
      );
    }

    const serviceSupabase = await createServiceRoleClient();

    console.log('[Staff API GET] Fetching staff list for role:', role);
    const { data, error } = await serviceSupabase
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
        branch:branches!staff_branch_id_fkey(id, branch_name, branch_code)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Staff API GET] Query error:', error);
      throw error;
    }

    console.log('[Staff API GET] Successfully fetched', (data || []).length, 'staff records');
    return apiSuccess(data ?? []);
  } catch (error) {
    console.error('[Staff API GET] Unexpected error:', error);
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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'SERVER_MISCONFIGURED',
            message: 'Server is missing SUPABASE_SERVICE_ROLE_KEY. Staff creation requires service role access.',
          },
        },
        { status: 500 }
      );
    }

    const serviceSupabase = await createServiceRoleClient();

    const body = await request.json();
    const requestedRole = (body.role as StaffRole | undefined) ?? 'staff';
    if (!ALLOWED_STAFF_ROLES.includes(requestedRole)) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid staff role. Only Manager, Staff, and Technician roles can be added.' } },
        { status: 400 }
      );
    }

    if (!body.password || typeof body.password !== 'string' || !body.password.trim()) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Password is required for staff login.' } },
        { status: 400 }
      );
    }

    const normalizedPassword = body.password.trim();
    if (normalizedPassword.length !== 6) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be exactly 6 characters.' } },
        { status: 400 }
      );
    }

    if ((requestedRole === 'staff' || requestedRole === 'technician') && !body.branch_id) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Branch is required for staff and technician roles.' } },
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

    const tempPassword = normalizedPassword;

    const { data: existingStaff, error: existingError } = await serviceSupabase
      .from('staff')
      .select('id')
      .eq('email', payload.email)
      .maybeSingle();

    if (existingError) {
      return Response.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to validate staff email.' } },
        { status: 500 }
      );
    }

    if (existingStaff) {
      return Response.json(
        { success: false, error: { code: 'DUPLICATE_EMAIL', message: 'A staff member with this email already exists.' } },
        { status: 409 }
      );
    }

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
      if (error.code === '42501' || String(error.message || '').toLowerCase().includes('row-level security')) {
        return Response.json(
          {
            success: false,
            error: {
              code: 'RLS_VIOLATION',
              message: 'Staff insert blocked by RLS. Verify SUPABASE_SERVICE_ROLE_KEY and staff RLS policies.',
            },
          },
          { status: 500 }
        );
      }
      return Response.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message || 'Failed to create staff record.' } },
        { status: 500 }
      );
    }

    void emailService
      .sendStaffCredentialsEmail({
        staffEmail: payload.email,
        staffName: payload.full_name,
        role: payload.role,
        password: tempPassword,
      })
      .then((emailResult) => {
        if (!emailResult.success) {
          console.error('[Staff API] Failed to send credentials email:', emailResult.error);
          return logEmailFailure({
            serviceSupabase,
            recipientEmail: payload.email,
            emailType: 'staff_credentials',
            payload: { staffName: payload.full_name, role: payload.role },
            errorMessage: emailResult.error || 'Unknown email error',
          });
        }
      })
      .catch((error) => {
        console.error('[Staff API] Failed to send credentials email:', error);
        return logEmailFailure({
          serviceSupabase,
          recipientEmail: payload.email,
          emailType: 'staff_credentials',
          payload: { staffName: payload.full_name, role: payload.role },
          errorMessage: String(error),
        });
      });

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

    let reassignedStaffId: string | null = null;
    if (role === 'manager' && userId) {
      const { data: managerSelf } = await serviceSupabase
        .from('staff')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle();
      reassignedStaffId = managerSelf?.id ?? null;
    }

    if (!reassignedStaffId) {
      const { data: manager } = await serviceSupabase
        .from('staff')
        .select('id')
        .eq('role', 'manager')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      reassignedStaffId = manager?.id ?? null;
    }

    if (!reassignedStaffId) {
      const { data: superadmin } = await serviceSupabase
        .from('staff')
        .select('id')
        .eq('role', 'superadmin')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      reassignedStaffId = superadmin?.id ?? null;
    }

    if (!reassignedStaffId) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'REASSIGNMENT_REQUIRED',
            message: 'No manager or superadmin found to reassign records. Create one before deleting staff.',
          },
        },
        { status: 400 }
      );
    }

    await serviceSupabase
      .from('services')
      .update({ assigned_technician_id: reassignedStaffId })
      .eq('assigned_technician_id', id);
    await serviceSupabase
      .from('services')
      .update({ created_by_staff_id: reassignedStaffId })
      .eq('created_by_staff_id', id);
    await serviceSupabase
      .from('services')
      .update({ completed_by_staff_id: reassignedStaffId })
      .eq('completed_by_staff_id', id);
    await serviceSupabase
      .from('invoices')
      .update({ created_by_staff_id: reassignedStaffId })
      .eq('created_by_staff_id', id);
    await serviceSupabase
      .from('expenses')
      .update({ created_by_staff_id: reassignedStaffId })
      .eq('created_by_staff_id', id);

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
