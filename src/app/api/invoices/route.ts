import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InvoiceRepository } from '@/infrastructure/repositories';
import { InvoiceCalculator } from '@/core/services';
import { invoiceSchema } from '@/lib/validators';
import { apiSuccess, apiError } from '@/core/api';
import { canCreateOrEdit, type StaffRole } from '@/lib/authz';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const repo = new InvoiceRepository(supabase);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const customerId = searchParams.get('customer_id') || undefined;

    const data = await repo.findAll({ status, customerId });
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    const userRole = ((user?.user_metadata?.role as StaffRole | undefined) ?? 'staff');
    if (!canCreateOrEdit(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only admin/manager/staff can create invoices.' }, { status: 403 });
    }

    const repo = new InvoiceRepository(supabase);
    const body = await request.json();
    const validated = invoiceSchema.parse(body);
    const { items, ...invoiceData } = validated;

    // Calculate totals via domain service
    const calculated = InvoiceCalculator.calculate(
      items,
      invoiceData.tax_percent ?? 0,
      invoiceData.discount_amount ?? 0
    );

    const invoice = await repo.create({ ...invoiceData, ...calculated });
    if (items.length > 0) {
      await repo.createItems(
        items.map((item) => ({ ...item, invoice_id: invoice.id }))
      );
    }
    return apiSuccess(invoice, 201);
  } catch (error) {
    return apiError(error);
  }
}
