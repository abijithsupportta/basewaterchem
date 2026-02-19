import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = supabase
    .from('quotations')
    .select(`
      *,
      customers(id, name, phone, location)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();
  const { items, ...quotationData } = body;

  // Insert quotation
  const { data: quotation, error: qError } = await supabase
    .from('quotations')
    .insert(quotationData)
    .select()
    .single();

  if (qError) return NextResponse.json({ error: qError.message }, { status: 400 });

  // Insert quotation items
  if (items?.length > 0) {
    const itemsWithQuotationId = items.map((item: any) => ({
      ...item,
      quotation_id: quotation.id,
    }));

    const { error: iError } = await supabase
      .from('quotation_items')
      .insert(itemsWithQuotationId);

    if (iError) return NextResponse.json({ error: iError.message }, { status: 400 });
  }

  return NextResponse.json(quotation, { status: 201 });
}
