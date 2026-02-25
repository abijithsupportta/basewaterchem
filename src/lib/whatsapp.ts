interface WhatsAppSendResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  response?: any;
}

interface ScheduledWhatsAppParams {
  customerName: string;
  customerPhone: string;
  scheduledDate: string;
}

interface ReminderConfig {
  daysAhead: number;
  sendTime: string;
  lastRunOn: string | null;
}

const FAST2SMS_API_URL = 'https://www.fast2sms.com/dev/whatsapp';

function normalizePhoneNumber(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function formatDateForMessage(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getIstNowParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    minutesOfDay: Number(map.hour) * 60 + Number(map.minute),
  };
}

function parseTimeToMinutes(timeValue: string): number {
  const [hh, mm] = String(timeValue || '10:00').split(':');
  const hours = Number(hh);
  const minutes = Number(mm);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 10 * 60;
  }
  return Math.min(23, Math.max(0, hours)) * 60 + Math.min(59, Math.max(0, minutes));
}

async function sendFast2SmsTemplate(params: {
  customerPhone: string;
  customerName: string;
  scheduledDate: string;
}): Promise<WhatsAppSendResult> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const messageId = process.env.FAST2SMS_WHATSAPP_MESSAGE_ID || '13504';
  const phoneNumberId = process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID || '913139511894019';

  if (!apiKey) {
    return { success: false, error: 'FAST2SMS_API_KEY is not configured' };
  }

  const mobileNumber = normalizePhoneNumber(params.customerPhone);
  if (!mobileNumber || mobileNumber.length < 10) {
    return { success: false, error: 'Customer phone number is invalid' };
  }

  const url = new URL(FAST2SMS_API_URL);
  url.searchParams.set('authorization', apiKey);
  url.searchParams.set('message_id', messageId);
  url.searchParams.set('phone_number_id', phoneNumberId);
  url.searchParams.set('numbers', mobileNumber);
  url.searchParams.set('variables_values', `${params.customerName}|${formatDateForMessage(params.scheduledDate)}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
    });

    const text = await response.text();
    let parsedBody: any = text;
    try {
      parsedBody = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        response: parsedBody,
        error: `Fast2SMS request failed (${response.status})`,
      };
    }

    return {
      success: true,
      statusCode: response.status,
      response: parsedBody,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function sendScheduledServiceWhatsApp(
  params: ScheduledWhatsAppParams
): Promise<WhatsAppSendResult> {
  return sendFast2SmsTemplate({
    customerPhone: params.customerPhone,
    customerName: params.customerName,
    scheduledDate: params.scheduledDate,
  });
}

export async function getReminderConfig(supabase: any): Promise<ReminderConfig> {
  const { data } = await supabase
    .from('company_settings')
    .select('reminder_days_ahead, reminder_send_time, last_whatsapp_reminder_run_on')
    .limit(1)
    .maybeSingle();

  return {
    daysAhead: Number(data?.reminder_days_ahead) > 0 ? Number(data.reminder_days_ahead) : 4,
    sendTime: data?.reminder_send_time || '10:00',
    lastRunOn: data?.last_whatsapp_reminder_run_on || null,
  };
}

export function shouldRunReminderNow(config: ReminderConfig): { shouldRun: boolean; todayIst: string } {
  const now = getIstNowParts();
  const scheduledMinutes = parseTimeToMinutes(config.sendTime);
  const alreadyRanToday = config.lastRunOn === now.date;

  return {
    shouldRun: !alreadyRanToday && now.minutesOfDay >= scheduledMinutes,
    todayIst: now.date,
  };
}

export async function sendReminderWhatsAppBatch(supabase: any, daysAhead: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysAhead);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  const results = {
    targetDate: targetDateStr,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const { data: services, error } = await supabase
    .from('services')
    .select('id, scheduled_date, whatsapp_reminder_sent_for_date, customer:customers(full_name, phone)')
    .eq('scheduled_date', targetDateStr)
    .in('status', ['scheduled', 'assigned']);

  if (error) {
    throw error;
  }

  for (const service of services || []) {
    const customer = service.customer;
    const customerName = customer?.full_name || 'Customer';
    const customerPhone = customer?.phone || '';

    if (service.whatsapp_reminder_sent_for_date === service.scheduled_date) {
      results.skipped++;
      continue;
    }

    const sendResult = await sendScheduledServiceWhatsApp({
      customerName,
      customerPhone,
      scheduledDate: service.scheduled_date,
    });

    if (sendResult.success) {
      await supabase.from('services').update({
        whatsapp_reminder_status: 'sent',
        whatsapp_reminder_sent_at: new Date().toISOString(),
        whatsapp_reminder_error: null,
        whatsapp_reminder_sent_for_date: service.scheduled_date,
      }).eq('id', service.id);
      results.sent++;
    } else {
      await supabase.from('services').update({
        whatsapp_reminder_status: 'failed',
        whatsapp_reminder_error: sendResult.error || 'Failed to send reminder',
      }).eq('id', service.id);
      results.failed++;
    }
  }

  return results;
}