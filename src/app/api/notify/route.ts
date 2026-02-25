import { NextRequest, NextResponse } from 'next/server';
import { sendServiceScheduledEmail, sendServiceCompletedEmail } from '@/lib/email';
import { sendScheduledServiceWhatsApp } from '@/lib/whatsapp';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...params } = body;
    const serviceSupabase = await createServiceRoleClient();

    const updateScheduledWhatsAppStatus = async (payload: {
      status: 'sent' | 'failed';
      error?: string | null;
    }) => {
      if (!params.serviceId) return;
      const updateData: Record<string, any> = {
        whatsapp_scheduled_status: payload.status,
        whatsapp_scheduled_error: payload.error || null,
      };
      if (payload.status === 'sent') {
        updateData.whatsapp_scheduled_sent_at = new Date().toISOString();
      }
      await serviceSupabase
        .from('services')
        .update(updateData)
        .eq('id', params.serviceId);
    };

    switch (type) {
      case 'service_scheduled': {
        await sendServiceScheduledEmail(params);
        if (params.customerPhone) {
          const waResult = await sendScheduledServiceWhatsApp({
            customerName: params.customerName || 'Customer',
            customerPhone: params.customerPhone,
            scheduledDate: params.scheduledDate,
          });
          await updateScheduledWhatsAppStatus({
            status: waResult.success ? 'sent' : 'failed',
            error: waResult.success ? null : waResult.error || 'Failed to send WhatsApp message',
          });
        } else {
          await updateScheduledWhatsAppStatus({
            status: 'failed',
            error: 'Customer phone not available',
          });
        }
        break;
      }
      case 'service_completed':
        await sendServiceCompletedEmail(params);
        break;
      default:
        return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Notify API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send notification' }, { status: 500 });
  }
}
