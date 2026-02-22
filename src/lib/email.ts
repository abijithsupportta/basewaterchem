/**
 * DEPRECATED: Use src/domain/services/email.service instead
 * This file is kept for backward compatibility during migration
 */

import { emailService } from '@/domain/services';

/**
 * @deprecated Use emailService.sendServiceScheduledEmail() from domain/services/email.service
 */
export async function sendServiceScheduledEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceNumber: string;
  serviceType: string;
  scheduledDate: string;
  description?: string;
}) {
  return await emailService.sendServiceScheduledEmail(params);
}

/**
 * @deprecated Use emailService.sendServiceCompletedEmail() from domain/services/email.service
 */
export async function sendServiceCompletedEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceNumber: string;
  serviceType: string;
  completedDate: string;
  workDone?: string;
  totalAmount?: number;
  nextServiceDate?: string;
}) {
  const baseParams = {
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    serviceNumber: params.serviceNumber,
    completedDate: params.completedDate,
    notes: params.workDone ? `Work Done: ${params.workDone}${params.totalAmount ? ` - Amount: Rs ${params.totalAmount}` : ''}` : undefined,
  };
  return await emailService.sendServiceCompletedEmail(baseParams);
}

/**
 * @deprecated Use emailService.sendServiceReminderEmail() from domain/services/email.service
 */
export async function sendServiceReminderEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceNumber: string;
  serviceType: string;
  scheduledDate: string;
  daysUntil: number;
  description?: string;
}) {
  return await emailService.sendServiceReminderEmail({
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    serviceNumber: params.serviceNumber,
    serviceType: params.serviceType,
    scheduledDate: params.scheduledDate,
    daysRemaining: params.daysUntil,
  });
}

/**
 * Batch send reminders for services due in N days
 * @deprecated Migrate to use domain services layer
 */
export async function sendBatchReminders(supabase: any) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results = { sent7day: 0, sent3day: 0, errors: 0 };

  for (const daysAhead of [7, 3]) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysAhead);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const { data: services, error } = await supabase
      .from('services')
      .select('*, customer:customers(id, full_name, email, phone)')
      .eq('scheduled_date', targetDateStr)
      .in('status', ['scheduled', 'assigned']);

    if (error) {
      console.error(`[Email] Failed to fetch services for ${daysAhead}-day reminder:`, error);
      continue;
    }

    for (const service of services || []) {
      const customer = service.customer;
      if (!customer?.email) continue;

      try {
        await sendServiceReminderEmail({
          customerEmail: customer.email,
          customerName: customer.full_name,
          serviceNumber: service.service_number || `SRV-${service.id.slice(0, 8)}`,
          serviceType:
            service.service_type === 'amc_service'
              ? 'Recurring Service'
              : service.service_type === 'installation'
                ? 'Installation'
                : service.service_type === 'free_service'
                  ? 'Free Service'
                  : 'Paid Service',
          scheduledDate: service.scheduled_date,
          daysUntil: daysAhead,
          description: service.description,
        });
        if (daysAhead === 7) results.sent7day++;
        else results.sent3day++;
      } catch {
        results.errors++;
      }
    }
  }

  return results;
}
