import { getProductsPage, getProductStats, getInventoryCategories } from './_queries';
import { ProductsList } from './_list';

interface Props {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q ?? '';
  const categoryId = params.category ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1') || 1);

  const [{ products, total, totalPages }, stats, categories] = await Promise.all([
    getProductsPage({ q, categoryId, page, pageSize: 50 }),
    getProductStats(),
    getInventoryCategories(),
  ]);

  return (
    <ProductsList
      products={products}
      total={total}
      totalPages={totalPages}
      currentPage={page}
      stats={stats}
      categories={categories}
      initialQuery={q}
      initialCategory={categoryId}
    />
  );
}
