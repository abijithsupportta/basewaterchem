import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Base Water Chemicals <onboarding@resend.dev>';
const COMPANY_NAME = 'Base Water Chemicals';
const COMPANY_PHONE = '+91 9876543210';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
    .container { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo h1 { color: #1e40af; font-size: 20px; margin: 0; }
    .content { color: #374151; font-size: 15px; line-height: 1.6; }
    .highlight { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .highlight p { margin: 4px 0; color: #1e3a5f; }
    .highlight strong { color: #1e40af; }
    .btn { display: inline-block; background: #2563eb; color: #fff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 16px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
    .footer a { color: #6b7280; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .success { background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo"><h1>💧 ${COMPANY_NAME}</h1></div>
      <div class="content">${content}</div>
    </div>
    <div class="footer">
      <p>${COMPANY_NAME} | Aqua Filter Service & Sales</p>
      <p>📞 ${COMPANY_PHONE}</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Email: Service Scheduled ───────────────────────────────

export async function sendServiceScheduledEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceNumber: string;
  serviceType: string;
  scheduledDate: string;
  description?: string;
}) {
  if (!params.customerEmail) return;

  const html = baseTemplate(`
    <p>Dear <strong>${params.customerName}</strong>,</p>
    <p>Your service has been scheduled. Here are the details:</p>
    <div class="highlight">
      <p><strong>Service #:</strong> ${params.serviceNumber}</p>
      <p><strong>Type:</strong> ${params.serviceType}</p>
      <p><strong>Scheduled Date:</strong> ${formatDate(params.scheduledDate)}</p>
      ${params.description ? `<p><strong>Details:</strong> ${params.description}</p>` : ''}
    </div>
    <p>Our team will visit you on the scheduled date. If you need to reschedule, please contact us.</p>
    <p>Thank you for choosing ${COMPANY_NAME}!</p>
  `);

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.customerEmail,
      subject: `Service Scheduled - ${params.serviceNumber} | ${COMPANY_NAME}`,
      html,
    });
    console.log(`[Email] Service scheduled notification sent to ${params.customerEmail}`);
  } catch (error) {
    console.error(`[Email] Failed to send scheduled notification:`, error);
  }
}

// ─── Email: Service Completed ───────────────────────────────

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
  if (!params.customerEmail) return;

  const amountHtml = params.totalAmount
    ? `<p><strong>Total Amount:</strong> ₹${params.totalAmount.toLocaleString('en-IN')}</p>`
    : '';

  const nextServiceHtml = params.nextServiceDate
    ? `
    <div class="highlight">
      <p>📅 <strong>Next Service Scheduled:</strong> ${formatDate(params.nextServiceDate)}</p>
      <p>We will notify you before your next service date.</p>
    </div>`
    : '';

  const html = baseTemplate(`
    <p>Dear <strong>${params.customerName}</strong>,</p>
    <div class="success">
      <p>✅ Your service <strong>${params.serviceNumber}</strong> has been completed successfully!</p>
    </div>
    <div class="highlight">
      <p><strong>Service #:</strong> ${params.serviceNumber}</p>
      <p><strong>Type:</strong> ${params.serviceType}</p>
      <p><strong>Completed On:</strong> ${formatDate(params.completedDate)}</p>
      ${params.workDone ? `<p><strong>Work Done:</strong> ${params.workDone}</p>` : ''}
      ${amountHtml}
    </div>
    ${nextServiceHtml}
    <p>If you have any questions or concerns, feel free to contact us.</p>
    <p>Thank you for choosing ${COMPANY_NAME}!</p>
  `);

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.customerEmail,
      subject: `Service Completed - ${params.serviceNumber} | ${COMPANY_NAME}`,
      html,
    });
    console.log(`[Email] Service completed notification sent to ${params.customerEmail}`);
  } catch (error) {
    console.error(`[Email] Failed to send completed notification:`, error);
  }
}

// ─── Email: Service Reminder (7 days / 3 days before) ───────

export async function sendServiceReminderEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceNumber: string;
  serviceType: string;
  scheduledDate: string;
  daysUntil: number;
  description?: string;
}) {
  if (!params.customerEmail) return;

  const urgency = params.daysUntil <= 3 ? 'warning' : 'highlight';
  const urgencyText = params.daysUntil <= 3
    ? `⚠️ Your service is in <strong>${params.daysUntil} day${params.daysUntil !== 1 ? 's' : ''}</strong>!`
    : `📅 Your service is coming up in <strong>${params.daysUntil} days</strong>.`;

  const html = baseTemplate(`
    <p>Dear <strong>${params.customerName}</strong>,</p>
    <div class="${urgency}">
      <p>${urgencyText}</p>
    </div>
    <div class="highlight">
      <p><strong>Service #:</strong> ${params.serviceNumber}</p>
      <p><strong>Type:</strong> ${params.serviceType}</p>
      <p><strong>Scheduled Date:</strong> ${formatDate(params.scheduledDate)}</p>
      ${params.description ? `<p><strong>Details:</strong> ${params.description}</p>` : ''}
    </div>
    <p>Please ensure someone is available at your location on the scheduled date. If you need to reschedule, contact us as soon as possible.</p>
    <p>Thank you,<br>${COMPANY_NAME}</p>
  `);

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.customerEmail,
      subject: `Service Reminder (${params.daysUntil} days) - ${params.serviceNumber} | ${COMPANY_NAME}`,
      html,
    });
    console.log(`[Email] ${params.daysUntil}-day reminder sent to ${params.customerEmail}`);
  } catch (error) {
    console.error(`[Email] Failed to send reminder:`, error);
  }
}

// ─── Batch: Send reminders for services due in N days ───────

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
          serviceType: service.service_type === 'amc_service' ? 'Recurring Service' : service.service_type === 'installation' ? 'Installation' : 'Paid Service',
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
