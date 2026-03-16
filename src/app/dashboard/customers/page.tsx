import { getCustomers } from './_queries';
import { CustomerList } from './_list';

interface Props {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}

export default async function CustomersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1') || 1);
  const pageSize = [20, 50, 100].includes(parseInt(params.pageSize ?? '50'))
    ? parseInt(params.pageSize!)
    : 50;

  const { customers, total, totalPages } = await getCustomers({ q, page, pageSize });

  return (
    <CustomerList
      customers={customers as any}
      total={total}
      totalPages={totalPages}
      currentPage={page}
      pageSize={pageSize}
      initialQuery={q}
    />
  );
}
