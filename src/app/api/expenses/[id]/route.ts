import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ExpenseRepository } from '@/infrastructure/repositories/expense.repository';
import { apiError, apiSuccess } from '@/core/api';
import { canCreateOrEdit, type StaffRole } from '@/lib/authz';
import { z } from 'zod';

const expenseUpdateSchema = z.object({
  expense_date: z.string().min(1, 'Expense date is required').optional(),
  title: z.string().min(2, 'Title is required').optional(),
  category: z.string().min(2, 'Category is required').optional(),
  amount: z.coerce.number().min(0, 'Amount must be positive').optional(),
  payment_method: z.string().optional(),
  reference_no: z.string().optional(),
  description: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');

    if (!canCreateOrEdit(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only superadmin/manager/staff can edit expenses.' }, { status: 403 });
    }

    const body = await request.json();
    const validated = expenseUpdateSchema.parse(body);

    const repo = new ExpenseRepository(supabase);
    const updated = await repo.update(id, validated);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');

    if (!canCreateOrEdit(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only superadmin/manager/staff can delete expenses.' }, { status: 403 });
    }

    const repo = new ExpenseRepository(supabase);
    await repo.delete(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
