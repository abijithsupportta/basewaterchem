import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ExpenseRepository } from '@/infrastructure/repositories/expense.repository';
import { apiError, apiPaginated, apiSuccess, parsePagination } from '@/core/api';
import { canCreateOrEdit, type StaffRole } from '@/lib/authz';
import { z } from 'zod';

const expenseSchema = z.object({
  expense_date: z.string().min(1, 'Expense date is required'),
  title: z.string().min(2, 'Title is required'),
  category: z.string().min(2, 'Category is required'),
  amount: z.coerce.number().min(0, 'Amount must be positive'),
  payment_method: z.string().optional(),
  reference_no: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new ExpenseRepository(supabase);
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = parsePagination(searchParams);

    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const category = searchParams.get('category') || undefined;

    const { data, count } = await repo.findAll({ from, to, category, page, limit, offset });
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

    if (!canCreateOrEdit(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only admin/manager/staff can create expenses.' }, { status: 403 });
    }

    const body = await request.json();
    const validated = expenseSchema.parse(body);

    let createdByStaffId: string | null = null;
    if (user?.id) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      createdByStaffId = staff?.id ?? null;
    }

    const repo = new ExpenseRepository(supabase);
    const created = await repo.create({ ...validated, created_by_staff_id: createdByStaffId });
    return apiSuccess(created, 201);
  } catch (error) {
    return apiError(error);
  }
}
