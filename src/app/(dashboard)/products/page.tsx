'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Loading } from '@/components/ui/loading';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { useProducts } from '@/hooks/use-products';
import { formatCurrency } from '@/lib/utils';
import { PRODUCT_CATEGORY_LABELS } from '@/lib/constants';

export default function ProductsPage() {
  const { products, loading } = useProducts();
  const [search, setSearch] = useState('');

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.model?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">{products.length} products in catalog</p>
        </div>
        <Link href="/dashboard/products/new">
          <Button><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
        </Link>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{search ? 'No products match your search' : 'No products yet'}</p>
          {!search && <Link href="/dashboard/products/new"><Button className="mt-4" variant="outline">Add First Product</Button></Link>}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <Link key={product.id} href={`/dashboard/products/${product.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <Badge variant="outline">{PRODUCT_CATEGORY_LABELS[product.category as keyof typeof PRODUCT_CATEGORY_LABELS] || product.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    {product.brand && <p className="text-muted-foreground">Brand: {product.brand}</p>}
                    {product.model && <p className="text-muted-foreground">Model: {product.model}</p>}
                    <div className="flex justify-between pt-2">
                      <span className="font-medium">{formatCurrency(product.price)}</span>
                      <span className="text-muted-foreground">{product.warranty_months}mo warranty</span>
                    </div>
                    {product.amc_interval_months && (
                      <p className="text-xs text-blue-600">AMC every {product.amc_interval_months} months</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
