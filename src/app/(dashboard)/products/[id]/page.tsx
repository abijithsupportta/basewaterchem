'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PRODUCT_CATEGORY_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [installations, setInstallations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    Promise.all([
      supabase.from('products').select('*').eq('id', id).single(),
      supabase.from('customer_products').select('*, customer:customers(full_name, customer_code, phone)').eq('product_id', id).order('installation_date', { ascending: false }),
    ]).then(([prodRes, instRes]) => {
      if (prodRes.data) setProduct(prodRes.data);
      if (instRes.data) setInstallations(instRes.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Loading />;
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Product not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/products')}>Back to Products</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground">{product.brand} {product.model_number && `- ${product.model_number}`}</p>
          </div>
          <Badge variant="outline">{PRODUCT_CATEGORY_LABELS[product.category as keyof typeof PRODUCT_CATEGORY_LABELS]}</Badge>
        </div>
        <Link href={`/dashboard/products/${id}/edit`}><Button><Edit className="mr-2 h-4 w-4" /> Edit</Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Price</p><p className="text-2xl font-bold">{formatCurrency(product.price)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Warranty</p><p className="text-2xl font-bold">{product.warranty_months} months</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">AMC Interval</p><p className="text-2xl font-bold">{product.amc_interval_months || 'N/A'} {product.amc_interval_months ? 'months' : ''}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Installations</p><p className="text-2xl font-bold">{installations.length}</p></CardContent></Card>
      </div>

      {product.description && (
        <Card><CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader><CardContent><p>{product.description}</p></CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Installations ({installations.length})</CardTitle></CardHeader>
        <CardContent>
          {installations.length === 0 ? <p className="text-sm text-muted-foreground">No installations yet</p> : (
            <div className="space-y-3">
              {installations.map((inst: any) => (
                <Link key={inst.id} href={`/dashboard/customers/${inst.customer_id}`} className="block">
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                    <div>
                      <p className="font-medium">{inst.customer?.full_name}</p>
                      <p className="text-sm text-muted-foreground">{inst.customer?.customer_code} | Serial: {inst.serial_number || 'N/A'} | Installed: {formatDate(inst.installation_date)}</p>
                    </div>
                    <Badge variant={new Date(inst.warranty_end_date) > new Date() ? 'default' : 'secondary'}>
                      {new Date(inst.warranty_end_date) > new Date() ? 'In Warranty' : 'Expired'}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
