import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InvoiceRepository } from '@/infrastructure/repositories';
import { apiSuccess, apiError } from '@/core/api';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const repo = new InvoiceRepository(supabase);

    // Detach any linked AMC contracts before deleting
    const { error: amcError } = await supabase
      .from('amc_contracts')
      .update({ invoice_id: null })
      .eq('invoice_id', id);
    if (amcError) throw amcError;

    await repo.delete(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
