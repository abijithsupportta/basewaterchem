import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ServiceRepository } from '@/infrastructure/repositories';
import { UnauthorizedError } from '@/core/errors';
import { apiSuccess, apiError } from '@/core/api';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedError('Invalid cron secret');
    }

    const supabase = await createServiceRoleClient();
    const serviceRepo = new ServiceRepository(supabase);

    // Generate upcoming services from AMC contracts
    const { error: genError } = await supabase.rpc('generate_all_upcoming_services');
    if (genError) console.error('Schedule generation error:', genError);

    const upcomingServices = await serviceRepo.findUpcoming(100);
    const overdueServices = await serviceRepo.findOverdue(100);

    return apiSuccess({
      upcoming: upcomingServices.length,
      overdue: overdueServices.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
