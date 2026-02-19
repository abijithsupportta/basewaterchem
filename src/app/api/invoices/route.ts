import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('payment_status');
  const customerId = searchParams.get('customer_id');

  let query = supabase
    .from('invoices')
    .select(`
      *,
      customers(id, name, phone, location)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('payment_status', status);
  if (customerId) query = query.eq('customer_id', customerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const body = await request.json();
  const { items, ...invoiceData } = body;

  // Insert invoice
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert(invoiceData)
    .select()
    .single();

  if (invError) return NextResponse.json({ error: invError.message }, { status: 400 });

  // Insert invoice items
  if (items?.length > 0) {
    const itemsWithInvoiceId = items.map((item: any) => ({
      ...item,
      invoice_id: invoice.id,
    }));

    const { error: iError } = await supabase
      .from('invoice_items')
      .insert(itemsWithInvoiceId);

    if (iError) return NextResponse.json({ error: iError.message }, { status: 400 });
  }

  return NextResponse.json(invoice, { status: 201 });
}
