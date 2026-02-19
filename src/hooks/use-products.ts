'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProductRepository, CustomerProductRepository } from '@/infrastructure/repositories';
import type { Product, ProductFormData, CustomerProduct, CustomerProductFormData } from '@/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const repo = useMemo(() => new ProductRepository(supabase), [supabase]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await repo.findAll({ isActive: true });
      setProducts(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const getProduct = useCallback((id: string) => repo.findById(id), [repo]);

  const createProduct = useCallback(async (formData: ProductFormData) => {
    const data = await repo.create(formData);
    await fetchProducts();
    return data;
  }, [repo, fetchProducts]);

  const updateProduct = useCallback(async (id: string, formData: Partial<ProductFormData>) => {
    const data = await repo.update(id, formData);
    await fetchProducts();
    return data;
  }, [repo, fetchProducts]);

  return { products, loading, error, fetchProducts, getProduct, createProduct, updateProduct };
}

export function useCustomerProducts(customerId?: string) {
  const [customerProducts, setCustomerProducts] = useState<CustomerProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const repo = useMemo(() => new CustomerProductRepository(supabase), [supabase]);

  const fetchCustomerProducts = useCallback(async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      const data = await repo.findByCustomer(customerId);
      setCustomerProducts(data);
    } catch (err) {
      console.error('Failed to fetch customer products:', err);
    } finally {
      setLoading(false);
    }
  }, [repo, customerId]);

  useEffect(() => { fetchCustomerProducts(); }, [fetchCustomerProducts]);

  const addCustomerProduct = useCallback(async (formData: CustomerProductFormData) => {
    const data = await repo.create(formData);
    await fetchCustomerProducts();
    return data;
  }, [repo, fetchCustomerProducts]);

  return { customerProducts, loading, fetchCustomerProducts, addCustomerProduct };
}
