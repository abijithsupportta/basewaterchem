import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { StaffRepository } from '@/infrastructure/repositories';
import { staffSchema } from '@/lib/validators';
import { apiSuccess, apiError } from '@/core/api';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new StaffRepository(supabase);
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || undefined;

    const data = await repo.findAll({ role, isActive: true });
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new StaffRepository(supabase);
    const body = await request.json();
    const validated = staffSchema.parse(body);
    const data = await repo.create(validated);
    return apiSuccess(data, 201);
  } catch (error) {
    return apiError(error);
  }
}
