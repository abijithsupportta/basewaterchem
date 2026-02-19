import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NotificationRepository } from '@/infrastructure/repositories';
import { apiSuccess, apiError } from '@/core/api';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new NotificationRepository(supabase);
    const data = await repo.findAll(50);
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new NotificationRepository(supabase);
    const body = await request.json();
    const { id } = body;

    if (id === 'all') {
      await repo.markAllAsRead();
    } else {
      await repo.markAsRead(id);
    }
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
