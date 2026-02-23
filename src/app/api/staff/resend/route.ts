import { NextRequest } from 'next/server';
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { emailService } from '@/domain/services';
import { canManageStaff, type StaffRole } from '@/lib/authz';

async function getCurrentUserRole() {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { role: null as StaffRole | null };
  }

  const metadataRole = userData.user.user_metadata?.role as StaffRole | undefined;
  if (metadataRole) {
    return { role: metadataRole };
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();

  return { role: (staff?.role as StaffRole) || null };
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

export async function POST(request: NextRequest) {
  try {
    const { role } = await getCurrentUserRole();
    if (!role || !canManageStaff(role)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Only superadmin can resend credentials.' } },
        { status: 403 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'SERVER_MISCONFIGURED',
            message: 'Server is missing SUPABASE_SERVICE_ROLE_KEY. Resend requires service role access.',
          },
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const id = body.id as string | undefined;
    const password = body.password as string | undefined;

    if (!id) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Staff id is required.' } },
        { status: 400 }
      );
    }

    if (!password || !password.trim()) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Password is required.' } },
        { status: 400 }
      );
    }

    const normalizedPassword = password.trim();
    if (normalizedPassword.length !== 6) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be exactly 6 characters.' } },
        { status: 400 }
      );
    }

    const serviceSupabase = await createServiceRoleClient();
    const { data: staff, error } = await serviceSupabase
      .from('staff')
      .select('id, auth_user_id, full_name, email, role')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return Response.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message || 'Failed to fetch staff.' } },
        { status: 500 }
      );
    }

    if (!staff || !staff.auth_user_id) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Staff record not found.' } },
        { status: 404 }
      );
    }

    const { error: updateError } = await serviceSupabase.auth.admin.updateUserById(staff.auth_user_id, {
      password: normalizedPassword,
    });

    if (updateError) {
      return Response.json(
        { success: false, error: { code: 'AUTH_UPDATE_FAILED', message: updateError.message || 'Failed to update password.' } },
        { status: 400 }
      );
    }

    void emailService
      .sendStaffCredentialsEmail({
        staffEmail: staff.email,
        staffName: staff.full_name,
        role: staff.role,
        password: normalizedPassword,
      })
      .then((emailResult) => {
        if (!emailResult.success) {
          return logEmailFailure({
            serviceSupabase,
            recipientEmail: staff.email,
            emailType: 'staff_credentials_resend',
            payload: { staffName: staff.full_name, role: staff.role },
            errorMessage: emailResult.error || 'Unknown email error',
          });
        }
      })
      .catch((error) => {
        return logEmailFailure({
          serviceSupabase,
          recipientEmail: staff.email,
          emailType: 'staff_credentials_resend',
          payload: { staffName: staff.full_name, role: staff.role },
          errorMessage: String(error),
        });
      });

    return Response.json({ success: true, data: { sent: true } }, { status: 200 });
  } catch (error) {
    console.error('[Staff API] Resend credentials error:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
