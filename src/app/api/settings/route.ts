import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DEFAULT_SETTINGS = {
  company_name: 'Base Water Chemicals',
  location: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: 'Kerala',
  pincode: '',
  phone: '',
  email: '',
  gst_number: '',
  bank_name: '',
  bank_account: '',
  bank_ifsc: '',
  reminder_days_ahead: 4,
  reminder_send_time: '10:00',
};

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      // Table might not exist yet — return defaults
      return NextResponse.json(DEFAULT_SETTINGS);
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const body = await request.json();
    const normalizedBody = {
      ...body,
      reminder_days_ahead:
        Number.isFinite(Number(body?.reminder_days_ahead)) && Number(body.reminder_days_ahead) > 0
          ? Number(body.reminder_days_ahead)
          : 4,
      reminder_send_time:
        typeof body?.reminder_send_time === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(body.reminder_send_time)
          ? body.reminder_send_time
          : '10:00',
    };

    // Check if row exists
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('company_settings')
        .update(normalizedBody)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase
        .from('company_settings')
        .insert(normalizedBody)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error('[Settings API]', error);
    return NextResponse.json({ error: error.message || 'Failed to save settings' }, { status: 500 });
  }
}
