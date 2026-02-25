import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ServiceRepository } from '@/infrastructure/repositories';
import { UnauthorizedError } from '@/core/errors';
import { apiSuccess, apiError } from '@/core/api';
import { sendBatchReminders } from '@/lib/email';
import { getReminderConfig, shouldRunReminderNow, sendReminderWhatsAppBatch } from '@/lib/whatsapp';

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

    // Send 7-day and 3-day reminder emails
    const emailResults = await sendBatchReminders(supabase);
    console.log('[Cron] Email reminders sent:', emailResults);

    const reminderConfig = await getReminderConfig(supabase);
    const runDecision = shouldRunReminderNow(reminderConfig);

    let whatsappResults: any = {
      attempted: false,
      reason: 'outside configured reminder time',
      config: reminderConfig,
    };

    if (runDecision.shouldRun) {
      const batchResult = await sendReminderWhatsAppBatch(supabase, reminderConfig.daysAhead);
      whatsappResults = {
        attempted: true,
        ...batchResult,
        config: reminderConfig,
      };

      const { data: settingsRow } = await supabase
        .from('company_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (settingsRow?.id) {
        await supabase
          .from('company_settings')
          .update({ last_whatsapp_reminder_run_on: runDecision.todayIst })
          .eq('id', settingsRow.id);
      }
    }

    const upcomingServices = await serviceRepo.findUpcoming(100);
    const overdueServices = await serviceRepo.findOverdue(100);

    return apiSuccess({
      upcoming: upcomingServices.length,
      overdue: overdueServices.length,
      emailReminders: emailResults,
      whatsappReminders: whatsappResults,
    });
  } catch (error) {
    return apiError(error);
  }
}
