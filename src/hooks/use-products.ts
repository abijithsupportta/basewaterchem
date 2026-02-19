'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Product, ProductFormData, CustomerProduct, CustomerProductFormData } from '@/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (fetchError) throw fetchError;
      setProducts(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const getProduct = async (id: string) => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  };

  const createProduct = async (formData: ProductFormData) => {
    const { data, error } = await supabase
      .from('products')
      .insert(formData)
      .select()
      .single();
    if (error) throw error;
    await fetchProducts();
    return data;
  };

  const updateProduct = async (id: string, formData: Partial<ProductFormData>) => {
    const { data, error } = await supabase
      .from('products')
      .update(formData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchProducts();
    return data;
  };

  return { products, loading, error, fetchProducts, getProduct, createProduct, updateProduct };
}

export function useCustomerProducts(customerId?: string) {
  const [customerProducts, setCustomerProducts] = useState<CustomerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchCustomerProducts = useCallback(async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_products')
        .select(`*, product:products (*)`)
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .order('installation_date', { ascending: false });
      if (error) throw error;
      setCustomerProducts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, customerId]);

  useEffect(() => {
    fetchCustomerProducts();
  }, [fetchCustomerProducts]);

  const addCustomerProduct = async (formData: CustomerProductFormData) => {
    const { data, error } = await supabase
      .from('customer_products')
      .insert(formData)
      .select()
      .single();
    if (error) throw error;
    await fetchCustomerProducts();
    return data;
  };

  return { customerProducts, loading, fetchCustomerProducts, addCustomerProduct };
}
