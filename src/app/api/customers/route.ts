import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CustomerRepository } from '@/infrastructure/repositories';
import { customerSchema } from '@/lib/validators';
import { apiSuccess, apiPaginated, apiError, parsePagination } from '@/core/api';
import { canManageCustomers, type StaffRole } from '@/lib/authz';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new CustomerRepository(supabase);
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = parsePagination(searchParams);
    const search = searchParams.get('search') || undefined;

    const { data, count } = await repo.findAll({ search, page, limit, offset });
    return apiPaginated(data, count, page, limit);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');
    if (!canManageCustomers(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only admin/manager can create customers.' }, { status: 403 });
    }

    const repo = new CustomerRepository(supabase);
    const body = await request.json();
    const validated = customerSchema.parse(body);
    const data = await repo.create(validated);
    return apiSuccess(data, 201);
  } catch (error) {
    return apiError(error);
  }
}
