import { getCompletedServices } from './_queries';
import { ServiceHistoryList } from './_list';

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function ServiceHistoryPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1') || 1);

  const { services, total, totalPages } = await getCompletedServices({ q, page, pageSize: 50 });

  return (
    <ServiceHistoryList
      services={services}
      total={total}
      totalPages={totalPages}
      currentPage={page}
      initialQuery={q}
    />
  );
}
