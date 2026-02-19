import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ServiceRepository } from '@/infrastructure/repositories';
import { serviceSchema } from '@/lib/validators';
import { apiSuccess, apiPaginated, apiError, parsePagination } from '@/core/api';

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
    const data = await repo.create(validated);
    return apiSuccess(data, 201);
  } catch (error) {
    return apiError(error);
  }
}
