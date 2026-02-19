import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ProductRepository } from '@/infrastructure/repositories';
import { productSchema } from '@/lib/validators';
import { apiSuccess, apiError } from '@/core/api';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new ProductRepository(supabase);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;

    const { data, count } = await repo.findAll({ category, search });
    return apiSuccess({ data, count });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new ProductRepository(supabase);
    const body = await request.json();
    const validated = productSchema.parse(body);
    const data = await repo.create(validated);
    return apiSuccess(data, 201);
  } catch (error) {
    return apiError(error);
  }
}
