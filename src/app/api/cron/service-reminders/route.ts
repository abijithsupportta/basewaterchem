import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ServiceRepository } from '@/infrastructure/repositories';
import { UnauthorizedError } from '@/core/errors';
import { apiSuccess, apiError } from '@/core/api';
import { sendBatchReminders } from '@/lib/email';
import { getReminderConfig, shouldRunReminderNow, sendReminderWhatsAppBatch } from '@/lib/whatsapp';

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  // Vercel Cron Jobs do not send custom authorization headers.
  if (isVercelCron) {
    return true;
  }

  if (!cronSecret) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Allows external schedulers that can only use query-string authentication.
  const secretParam = request.nextUrl.searchParams.get('secret');
  return secretParam === cronSecret;
}

function isDryRun(request: NextRequest): boolean {
  const value = (request.nextUrl.searchParams.get('dryRun') || '').toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function getCronReadiness() {
  return {
    hasCronSecret: Boolean(process.env.CRON_SECRET),
    hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasFast2SmsApiKey: Boolean(process.env.FAST2SMS_API_KEY),
    route: '/api/cron/service-reminders',
    schedule: '0 0 * * *',
  };
}

async function runServiceReminders() {
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

  return {
    upcoming: upcomingServices.length,
    overdue: overdueServices.length,
    emailReminders: emailResults,
    whatsappReminders: whatsappResults,
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      throw new UnauthorizedError('Invalid cron secret');
    }

    if (isDryRun(request)) {
      return apiSuccess({
        ok: true,
        dryRun: true,
        message: 'Cron endpoint is reachable and authorized. No reminders were sent.',
        readiness: getCronReadiness(),
      });
    }

    return apiSuccess(await runServiceReminders());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      throw new UnauthorizedError('Invalid cron secret');
    }

    if (isDryRun(request)) {
      return apiSuccess({
        ok: true,
        dryRun: true,
        message: 'Cron endpoint is reachable and authorized. No reminders were sent.',
        readiness: getCronReadiness(),
      });
    }

    return apiSuccess(await runServiceReminders());
  } catch (error) {
    return apiError(error);
  }
}
