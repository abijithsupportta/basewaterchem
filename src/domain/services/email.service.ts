/**
 * Email Service - Domain Layer
 * Pure business logic for email composition and sending
 * Framework-independent, testable
 */

import nodemailer from 'nodemailer';

interface EmailParams {
  customerEmail: string;
  customerName: string;
  [key: string]: any;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  private readonly FROM_EMAIL = `Base Water Chemicals <${process.env.GMAIL_USER || 'info@abijithcb.com'}>`;
  private readonly COMPANY_NAME = 'Base Water Chemicals';
  private readonly COMPANY_PHONE = '+91 9876543210';

  /**
   * Format date for email display (India timezone)
   */
  formatDateForEmail(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Base HTML template for all emails
   */
  private getBaseTemplate(content: string): string {
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
      <div class="logo"><h1>💧 ${this.COMPANY_NAME}</h1></div>
      <div class="content">${content}</div>
    </div>
    <div class="footer">
      <p>${this.COMPANY_NAME} | Aqua Filter Service & Sales</p>
      <p>📞 ${this.COMPANY_PHONE}</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Send service scheduled notification email
   */
  async sendServiceScheduledEmail(params: {
    customerEmail: string;
    customerName: string;
    serviceNumber: string;
    serviceType: string;
    scheduledDate: string;
    description?: string;
  }): Promise<EmailResult> {
    if (!params.customerEmail) {
      return { success: false, error: 'Customer email is required' };
    }

    const html = this.getBaseTemplate(`
      <p>Dear <strong>${params.customerName}</strong>,</p>
      <p>Your service has been scheduled. Here are the details:</p>
      <div class="highlight">
        <p><strong>Service #:</strong> ${params.serviceNumber}</p>
        <p><strong>Type:</strong> ${params.serviceType}</p>
        <p><strong>Scheduled Date:</strong> ${this.formatDateForEmail(params.scheduledDate)}</p>
        ${params.description ? `<p><strong>Details:</strong> ${params.description}</p>` : ''}
      </div>
      <p>Our team will visit you on the scheduled date. If you need to reschedule, please contact us.</p>
      <p>Thank you for choosing ${this.COMPANY_NAME}!</p>
    `);

    try {
      const result = await this.transporter.sendMail({
        from: this.FROM_EMAIL,
        to: params.customerEmail,
        subject: `Service Scheduled - ${params.serviceNumber} | ${this.COMPANY_NAME}`,
        html,
      });
      console.log(`[Email] Service scheduled notification sent to ${params.customerEmail}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`[Email] Failed to send scheduled notification:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send service completed notification email
   */
  async sendServiceCompletedEmail(params: {
    customerEmail: string;
    customerName: string;
    serviceNumber: string;
    completedDate: string;
    notes?: string;
  }): Promise<EmailResult> {
    if (!params.customerEmail) {
      return { success: false, error: 'Customer email is required' };
    }

    const html = this.getBaseTemplate(`
      <p>Dear <strong>${params.customerName}</strong>,</p>
      <p>Your service has been completed successfully!</p>
      <div class="success">
        <p><strong>Service #:</strong> ${params.serviceNumber}</p>
        <p><strong>Completed Date:</strong> ${this.formatDateForEmail(params.completedDate)}</p>
        ${params.notes ? `<p><strong>Notes:</strong> ${params.notes}</p>` : ''}
      </div>
      <p>Thank you for choosing ${this.COMPANY_NAME}. We look forward to serving you again!</p>
    `);

    try {
      const result = await this.transporter.sendMail({
        from: this.FROM_EMAIL,
        to: params.customerEmail,
        subject: `Service Completed - ${params.serviceNumber} | ${this.COMPANY_NAME}`,
        html,
      });
      console.log(`[Email] Service completion notification sent to ${params.customerEmail}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`[Email] Failed to send completion notification:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send service reminder email
   */
  async sendServiceReminderEmail(params: {
    customerEmail: string;
    customerName: string;
    serviceNumber: string;
    serviceType: string;
    scheduledDate: string;
    daysRemaining: number;
  }): Promise<EmailResult> {
    if (!params.customerEmail) {
      return { success: false, error: 'Customer email is required' };
    }

    const html = this.getBaseTemplate(`
      <p>Dear <strong>${params.customerName}</strong>,</p>
      <p>This is a friendly reminder about your upcoming service.</p>
      <div class="highlight">
        <p><strong>Service #:</strong> ${params.serviceNumber}</p>
        <p><strong>Type:</strong> ${params.serviceType}</p>
        <p><strong>Scheduled Date:</strong> ${this.formatDateForEmail(params.scheduledDate)}</p>
        <p><strong>Days Remaining:</strong> ${params.daysRemaining}</p>
      </div>
      <p>If you need to reschedule or have any questions, please contact us immediately.</p>
      <p>Thank you!</p>
    `);

    try {
      const result = await this.transporter.sendMail({
        from: this.FROM_EMAIL,
        to: params.customerEmail,
        subject: `Service Reminder - ${params.serviceNumber} | ${this.COMPANY_NAME}`,
        html,
      });
      console.log(`[Email] Service reminder sent to ${params.customerEmail}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`[Email] Failed to send reminder notification:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send staff login credentials email
   */
  async sendStaffCredentialsEmail(params: {
    staffEmail: string;
    staffName: string;
    role: string;
    password: string;
  }): Promise<EmailResult> {
    if (!params.staffEmail) {
      return { success: false, error: 'Staff email is required' };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const loginUrl = `${appUrl.replace(/\/$/, '')}/login`;

    const html = this.getBaseTemplate(`
      <p>Dear <strong>${params.staffName}</strong>,</p>
      <p>Your account has been created. You can log in using the details below:</p>
      <div class="highlight">
        <p><strong>Email:</strong> ${params.staffEmail}</p>
        <p><strong>Password:</strong> ${params.password}</p>
        <p><strong>Role:</strong> ${params.role}</p>
      </div>
      <p>Please log in and keep your credentials secure. If you need help, contact the administrator.</p>
      <a class="btn" href="${loginUrl}">Log In</a>
    `);

    try {
      const result = await this.transporter.sendMail({
        from: this.FROM_EMAIL,
        to: params.staffEmail,
        subject: `Your Login Credentials | ${this.COMPANY_NAME}`,
        html,
      });
      console.log(`[Email] Staff credentials sent to ${params.staffEmail}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`[Email] Failed to send staff credentials:`, error);
      return { success: false, error: String(error) };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export type { EmailResult };
