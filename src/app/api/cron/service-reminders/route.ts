import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ServiceRepository, NotificationRepository } from '@/infrastructure/repositories';
import { UnauthorizedError } from '@/core/errors';
import { apiSuccess, apiError } from '@/core/api';

interface ServiceWithCustomer {
  id: string;
  customers?: { name?: string } | null;
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedError('Invalid cron secret');
    }

    const supabase = await createServiceRoleClient();
    const serviceRepo = new ServiceRepository(supabase);
    const notificationRepo = new NotificationRepository(supabase);

    // Generate upcoming services from AMC contracts
    const { error: genError } = await supabase.rpc('generate_all_upcoming_services');
    if (genError) throw genError;

    // Find services scheduled for tomorrow
    const upcomingServices = await serviceRepo.findUpcoming(100) as ServiceWithCustomer[];
    if (upcomingServices.length > 0) {
      await notificationRepo.createMany(
        upcomingServices.map((s) => ({
          type: 'service_reminder' as const,
          title: 'Service Tomorrow',
          message: `Service scheduled tomorrow for ${s.customers?.name || 'customer'}`,
          related_id: s.id,
          related_type: 'service',
        }))
      );
    }

    // Find overdue services
    const overdueServices = await serviceRepo.findOverdue(100) as ServiceWithCustomer[];
    if (overdueServices.length > 0) {
      await notificationRepo.createMany(
        overdueServices.map((s) => ({
          type: 'service_overdue' as const,
          title: 'Service Overdue',
          message: `Overdue service for ${s.customers?.name || 'customer'}`,
          related_id: s.id,
          related_type: 'service',
        }))
      );
    }

    return apiSuccess({
      generated: upcomingServices.length,
      overdue: overdueServices.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
