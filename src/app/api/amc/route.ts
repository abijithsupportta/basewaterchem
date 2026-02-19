import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AmcRepository } from '@/infrastructure/repositories';
import { amcSchema } from '@/lib/validators';
import { apiSuccess, apiError } from '@/core/api';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new AmcRepository(supabase);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const customerId = searchParams.get('customer_id') || undefined;

    const data = await repo.findAll({ status, customerId });
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new AmcRepository(supabase);
    const body = await request.json();
    const validated = amcSchema.parse(body);
    const data = await repo.create(validated);
    return apiSuccess(data, 201);
  } catch (error) {
    return apiError(error);
  }
}
