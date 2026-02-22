import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ServiceRepository } from '@/infrastructure/repositories';
import { serviceSchema } from '@/lib/validators';
import { apiSuccess, apiPaginated, apiError, parsePagination } from '@/core/api';
import { canCreateOrEdit, type StaffRole } from '@/lib/authz';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new ServiceRepository(supabase);
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = parsePagination(searchParams);
    const status = searchParams.get('status') || undefined;
    const serviceType = searchParams.get('type') || undefined;

    const { data, count } = await repo.findAll({ status, type: serviceType, page, limit, offset });
    return apiPaginated(data, count, page, limit);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new ServiceRepository(supabase);
    const body = await request.json();
    const validated = serviceSchema.parse(body);

    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');
    if (!canCreateOrEdit(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only admin/manager/staff can create services.' }, { status: 403 });
    }

    // Get staff details for tracking
    let staffId: string | null = null;
    let staffName: string | null = null;
    if (user) {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      
      if (staffData) {
        staffId = staffData.id;
        staffName = staffData.full_name;
      }
    }

    const data = await repo.create({
      ...validated,
      created_by_staff_id: staffId,
      created_by_staff_name: staffName,
    });
    return apiSuccess(data, 201);
  } catch (error) {
    return apiError(error);
  }
}
