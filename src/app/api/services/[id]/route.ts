import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ServiceRepository } from '@/infrastructure/repositories';
import { apiSuccess, apiError } from '@/core/api';
import { canDelete, type StaffRole } from '@/lib/authz';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const repo = new ServiceRepository(supabase);

    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');
    if (!canDelete(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only admin can delete services.' }, { status: 403 });
    }

    await repo.delete(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
