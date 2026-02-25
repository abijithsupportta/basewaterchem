import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { canCreateOrEdit, type StaffRole } from '@/lib/authz';
import { sendScheduledServiceWhatsApp } from '@/lib/whatsapp';

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date') || '';

    if (!isValidDateString(targetDate)) {
      return NextResponse.json({ error: 'Invalid or missing date. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const supabase = await createServiceRoleClient();
    const { count, error } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_date', targetDate)
      .in('status', ['scheduled', 'assigned']);

    if (error) {
      throw error;
    }

    return NextResponse.json({ date: targetDate, count: count || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch count' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');

    if (!canCreateOrEdit(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const targetDate = String(body?.date || '');
    const offset = Number.isFinite(Number(body?.offset)) ? Math.max(0, Number(body.offset)) : 0;
    const limit = Number.isFinite(Number(body?.limit)) ? Math.min(100, Math.max(1, Number(body.limit))) : 20;

    if (!isValidDateString(targetDate)) {
      return NextResponse.json({ error: 'Invalid or missing date. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const serviceSupabase = await createServiceRoleClient();
    const { data: services, error, count } = await serviceSupabase
      .from('services')
      .select('id, scheduled_date, customer:customers(full_name, phone)')
      .eq('scheduled_date', targetDate)
      .in('status', ['scheduled', 'assigned'])
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    let sent = 0;
    let failed = 0;

    for (const service of services || []) {
      const customer = Array.isArray(service.customer)
        ? service.customer[0]
        : service.customer;
      const result = await sendScheduledServiceWhatsApp({
        customerName: customer?.full_name || 'Customer',
        customerPhone: customer?.phone || '',
        scheduledDate: service.scheduled_date,
      });

      if (result.success) {
        await serviceSupabase
          .from('services')
          .update({
            whatsapp_reminder_status: 'sent',
            whatsapp_reminder_sent_at: new Date().toISOString(),
            whatsapp_reminder_error: null,
            whatsapp_reminder_sent_for_date: service.scheduled_date,
          })
          .eq('id', service.id);
        sent++;
      } else {
        await serviceSupabase
          .from('services')
          .update({
            whatsapp_reminder_status: 'failed',
            whatsapp_reminder_error: result.error || 'Failed to send WhatsApp notification',
          })
          .eq('id', service.id);
        failed++;
      }
    }

    return NextResponse.json({
      date: targetDate,
      total: count || 0,
      batchCount: (services || []).length,
      offset,
      nextOffset: offset + (services || []).length,
      hasMore: offset + (services || []).length < (count || 0),
      sent,
      failed,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to send notifications' }, { status: 500 });
  }
}
