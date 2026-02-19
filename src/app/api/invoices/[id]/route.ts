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

    // Find AMC contracts linked to this invoice
    const { data: contracts } = await supabase
      .from('amc_contracts')
      .select('id')
      .eq('invoice_id', id);

    const contractIds = (contracts || []).map((c: { id: string }) => c.id);

    // Delete services linked to these AMC contracts
    if (contractIds.length > 0) {
      const { error: svcError } = await supabase
        .from('services')
        .delete()
        .in('amc_contract_id', contractIds);
      if (svcError) throw svcError;
    }

    // Delete services directly linked to this invoice
    const { error: directSvcError } = await supabase
      .from('services')
      .delete()
      .eq('invoice_id', id);
    if (directSvcError) throw directSvcError;

    // Delete the AMC contracts themselves
    if (contractIds.length > 0) {
      const { error: amcError } = await supabase
        .from('amc_contracts')
        .delete()
        .in('id', contractIds);
      if (amcError) throw amcError;
    }

    await repo.delete(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
