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

    // Check if row exists
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('company_settings')
        .update(body)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase
        .from('company_settings')
        .insert(body)
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
