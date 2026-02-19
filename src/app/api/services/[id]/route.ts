import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ServiceRepository } from '@/infrastructure/repositories';
import { apiSuccess, apiError } from '@/core/api';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const repo = new ServiceRepository(supabase);

    await repo.delete(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
