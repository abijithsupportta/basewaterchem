'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { productSchema } from '@/lib/validators';
import { useProducts } from '@/hooks/use-products';
import { PRODUCT_CATEGORY_LABELS } from '@/lib/constants';
import type { ProductFormData } from '@/types';

export default function NewProductPage() {
  const router = useRouter();
  const { createProduct } = useProducts();
  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { category: 'water_purifier', warranty_months: 12, amc_interval_months: 3 },
  });

  const onSubmit = async (data: ProductFormData) => {
    try {
      await createProduct(data);
      toast.success('Product created successfully!');
      router.push('/dashboard/products');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create product');
    }
  };

  const categoryOptions = Object.entries(PRODUCT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">New Product</h1>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input id="name" {...register('name')} placeholder="e.g., RO Water Purifier 15L" />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <SimpleSelect options={categoryOptions} value={watch('category')} onChange={(v) => setValue('category', v as any)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" {...register('brand')} placeholder="e.g., Kent, Aquaguard" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model_number">Model Number</Label>
                <Input id="model_number" {...register('model')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (₹) *</Label>
                <Input id="price" type="number" {...register('price', { valueAsNumber: true })} />
                {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="warranty_months">Warranty (months) *</Label>
                <Input id="warranty_months" type="number" {...register('warranty_months', { valueAsNumber: true })} />
                {errors.warranty_months && <p className="text-sm text-destructive">{errors.warranty_months.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amc_interval_months">AMC Interval (months)</Label>
                <Input id="amc_interval_months" type="number" {...register('amc_interval_months', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register('description')} />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Product</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
