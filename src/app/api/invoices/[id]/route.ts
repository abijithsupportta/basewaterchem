import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InvoiceRepository } from '@/infrastructure/repositories';
import { isSuperadmin, type StaffRole } from '@/lib/authz';
import { apiSuccess, apiError } from '@/core/api';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');
    if (!isSuperadmin(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only superadmin can delete invoices.' }, { status: 403 });
    }

    const repo = new InvoiceRepository(supabase);
    await repo.delete(id);
    return apiSuccess({ message: 'Invoice deleted successfully' });
  } catch (error) {
    return apiError(error);
  }
}
