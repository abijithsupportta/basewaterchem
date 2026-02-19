import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ComplaintRepository } from '@/infrastructure/repositories';
import { complaintSchema } from '@/lib/validators';
import { apiSuccess, apiError } from '@/core/api';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new ComplaintRepository(supabase);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;

    const data = await repo.findAll({ status, priority });
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new ComplaintRepository(supabase);
    const body = await request.json();
    const validated = complaintSchema.parse(body);
    const data = await repo.create(validated);
    return apiSuccess(data, 201);
  } catch (error) {
    return apiError(error);
  }
}
