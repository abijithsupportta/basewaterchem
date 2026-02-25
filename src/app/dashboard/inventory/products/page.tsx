'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, AlertTriangle, Tag, Search, TrendingUp, ShoppingCart, Archive, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InventoryCategory, InventoryProduct } from '@/types/inventory';
import { useUserRole } from '@/lib/use-user-role';
import { canDelete } from '@/lib/authz';
import { readStaleCache, writeStaleCache } from '@/lib/stale-cache';

type InventoryProductsCachePayload = {
  categories: InventoryCategory[];
  products: InventoryProduct[];
};

const INVENTORY_PRODUCTS_CACHE_KEY = 'dashboard:inventory:products:v1';
const INVENTORY_PRODUCTS_CACHE_TTL_MS = 600000;

export default function ProductsPage() {
  const userRole = useUserRole();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryProduct | null>(null);
  
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const cached = readStaleCache<InventoryProductsCachePayload>(
      INVENTORY_PRODUCTS_CACHE_KEY,
      INVENTORY_PRODUCTS_CACHE_TTL_MS
    );

    if (cached) {
      setCategories(cached.categories);
      setProducts(cached.products);
      setLoading(false);
    }

    fetchData(Boolean(cached));
  }, []);

  const fetchData = async (background = false) => {
    if (!background) {
      setLoading(true);
    }
    try {
      const [categoriesRes, productsRes] = await Promise.all([
        fetch('/api/inventory/categories'),
        fetch('/api/inventory/products'),
      ]);

      let nextCategories: InventoryCategory[] = categories;
      let nextProducts: InventoryProduct[] = products;

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
        nextCategories = categoriesData;
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
        nextProducts = productsData;
      }

      writeStaleCache<InventoryProductsCachePayload>(INVENTORY_PRODUCTS_CACHE_KEY, {
        categories: nextCategories,
        products: nextProducts,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  };

  // Filter products by category and search query
  const filteredProducts = products.filter((product) => {
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    const matchesSearch = !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  const lowStockProducts = products.filter(
    (p) => p.is_active && p.min_stock_level && p.stock_quantity <= p.min_stock_level
  );

  // Calculate inventory statistics
  const stats = {
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.is_active).length,
    totalStockQuantity: products.reduce((sum, p) => sum + p.stock_quantity, 0),
    totalStockValue: products.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0),
    outOfStock: products.filter((p) => p.is_active && p.stock_quantity === 0).length,
    lowStock: lowStockProducts.length,
    totalCategories: new Set(products.map((p) => p.category_id).filter(Boolean)).size,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const res = await fetch(`/api/inventory/products/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Update local state instead of fetching all data
        setProducts((prev) => {
          const updated = prev.filter((p) => p.id !== id);
          writeStaleCache<InventoryProductsCachePayload>(INVENTORY_PRODUCTS_CACHE_KEY, {
            categories,
            products: updated,
          });
          return updated;
        });
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const updateProductStock = (productId: string, newStock: number) => {
    setProducts((prev) => {
      const updated = prev.map((p) => (p.id === productId ? { ...p, stock_quantity: newStock } : p));
      writeStaleCache<InventoryProductsCachePayload>(INVENTORY_PRODUCTS_CACHE_KEY, {
        categories,
        products: updated,
      });
      return updated;
    });
  };

  const handleProductSaved = (savedProduct: InventoryProduct) => {
    setProducts((prev) => {
      const index = prev.findIndex((p) => p.id === savedProduct.id);
      if (index >= 0) {
        // Update existing product
        const updated = [...prev];
        updated[index] = savedProduct;
        writeStaleCache<InventoryProductsCachePayload>(INVENTORY_PRODUCTS_CACHE_KEY, {
          categories,
          products: updated,
        });
        return updated;
      } else {
        // Add new product
        const updated = [...prev, savedProduct];
        writeStaleCache<InventoryProductsCachePayload>(INVENTORY_PRODUCTS_CACHE_KEY, {
          categories,
          products: updated,
        });
        return updated;
      }
    });
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products & Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive inventory management and stock tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/inventory/categories">
            <Button variant="outline">
              <Tag className="mr-2 h-4 w-4" /> Categories
            </Button>
          </Link>
          <Button onClick={() => setShowProductDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Inventory Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.activeProducts} active
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Stock Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalStockValue)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Inventory worth
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items in Stock</p>
                <p className="text-2xl font-bold">{formatNumber(stats.totalStockQuantity)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalCategories} categories
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Archive className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stock Alerts</p>
                <p className="text-2xl font-bold">
                  {stats.lowStock + stats.outOfStock}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.lowStock} low, {stats.outOfStock} out
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Low Stock Alert - {lowStockProducts.length} {lowStockProducts.length === 1 ? 'product needs' : 'products need'} attention
              </CardTitle>
              <Badge variant="outline" className="text-amber-700 border-amber-300">
                Value: {formatCurrency(
                  lowStockProducts.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0)
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {lowStockProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    setAdjustingProduct(product);
                    setShowStockDialog(true);
                  }}
                  className="flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-1.5 hover:bg-amber-50 transition-colors"
                >
                  <span className="text-sm font-medium">{product.name}</span>
                  <Badge variant="outline" className="text-amber-700 border-amber-300">
                    {product.stock_quantity} {product.unit_of_measure || 'pcs'}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products by name, SKU, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Categories</option>
                {categories.map((category) => {
                  const count = products.filter((p) => p.category_id === category.id).length;
                  return (
                    <option key={category.id} value={category.id}>
                      {category.name} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
            {(searchQuery || selectedCategory) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Showing:</span>
              <span className="font-semibold">{filteredProducts.length}</span>
              <span className="text-muted-foreground">products</span>
            </div>
            {(searchQuery || selectedCategory) && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Filtered Value:</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      filteredProducts.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0)
                    )}
                  </span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-semibold">
                    {formatNumber(filteredProducts.reduce((sum, p) => sum + p.stock_quantity, 0))}
                  </span>
                </div>
              </>
            )}
            {selectedCategory && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {categories.find((c) => c.id === selectedCategory)?.name}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {searchQuery || selectedCategory
                  ? 'No products match your search criteria'
                  : 'No products yet. Click "Add Product" to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-3 px-4 text-left font-medium text-sm">Product</th>
                    <th className="py-3 px-4 text-left font-medium text-sm">SKU</th>
                    <th className="py-3 px-4 text-left font-medium text-sm">Category</th>
                    <th className="py-3 px-4 text-right font-medium text-sm">Price</th>
                    <th className="py-3 px-4 text-right font-medium text-sm">Stock</th>
                    <th className="py-3 px-4 text-center font-medium text-sm">Status</th>
                    <th className="py-3 px-4 text-right font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {product.sku || 'N/A'}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        {product.category ? (
                          <Badge variant="outline" className="font-normal">
                            {product.category.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Uncategorized</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(product.unit_price)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setAdjustingProduct(product);
                            setShowStockDialog(true);
                          }}
                          className="hover:bg-muted rounded px-3 py-1.5 transition-colors inline-flex items-center gap-2"
                          title="Click to manage stock"
                        >
                          <span
                            className={`font-semibold text-sm ${
                              product.min_stock_level &&
                              product.stock_quantity <= product.min_stock_level
                                ? 'text-amber-600'
                                : 'text-foreground'
                            }`}
                          >
                            {product.stock_quantity}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {product.unit_of_measure || 'pcs'}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={product.is_active ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingProduct(product);
                              setShowProductDialog(true);
                            }}
                            title="Edit product"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {canDelete(userRole) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteProduct(product.id)}
                              title="Delete product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20">
                    <td colSpan={4} className="py-3 px-4 font-semibold">
                      Page Total ({paginatedProducts.length} {paginatedProducts.length === 1 ? 'item' : 'items'})
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {formatCurrency(
                        paginatedProducts.reduce((sum, p) => sum + (p.unit_price || 0), 0)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {paginatedProducts.reduce((sum, p) => sum + (p.stock_quantity || 0), 0).toLocaleString('en-IN')}
                    </td>
                    <td colSpan={2} className="py-3 px-4 text-right text-sm text-muted-foreground">
                      Value: {formatCurrency(
                        paginatedProducts.reduce(
                          (sum, p) => sum + (p.stock_quantity || 0) * (p.unit_price || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showProductDialog && (
        <ProductDialog
          product={editingProduct}
          categories={categories}
          onClose={() => {
            setShowProductDialog(false);
            setEditingProduct(null);
          }}
          onSave={(savedProduct) => {
            handleProductSaved(savedProduct);
            setShowProductDialog(false);
            setEditingProduct(null);
          }}
        />
      )}

      {showStockDialog && adjustingProduct && (
        <StockAdjustmentDialog
          product={adjustingProduct}
          onClose={() => {
            setShowStockDialog(false);
            setAdjustingProduct(null);
          }}
          onSave={(newStock) => {
            updateProductStock(adjustingProduct.id, newStock);
            setShowStockDialog(false);
            setAdjustingProduct(null);
          }}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of{' '}
                {filteredProducts.length} results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      // Show first page, last page, current page, and pages around current
                      return (
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1
                      );
                    })
                    .map((page, index, array) => (
                      <div key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-2 text-muted-foreground">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="min-w-[40px]"
                        >
                          {page}
                        </Button>
                      </div>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProductDialog({
  product,
  categories,
  onClose,
  onSave,
}: {
  product: InventoryProduct | null;
  categories: InventoryCategory[];
  onClose: () => void;
  onSave: (savedProduct: InventoryProduct) => void;
}) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    sku: product?.sku || '',
    category_id: product?.category_id || '',
    unit_price: product?.unit_price || 0,
    stock_quantity: product?.stock_quantity || 0,
    min_stock_level: product?.min_stock_level || 0,
    unit_of_measure: product?.unit_of_measure || 'piece',
    notes: product?.notes || '',
    is_active: product?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = product
        ? `/api/inventory/products/${product.id}`
        : '/api/inventory/products';
      const method = product ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          category_id: formData.category_id || null,
        }),
      });

      if (res.ok) {
        const savedProduct = await res.json();
        onSave(savedProduct);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save product');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{product ? 'Edit' : 'Add'} Product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Product Name *</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label>SKU (Optional)</Label>
                <Input
                  type="text"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                  className="mt-1"
                  placeholder="Leave empty if not applicable"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData({ ...formData, category_id: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border p-2"
                >
                  <option value="">No Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Unit of Measure</Label>
                <Input
                  type="text"
                  value={formData.unit_of_measure}
                  onChange={(e) =>
                    setFormData({ ...formData, unit_of_measure: e.target.value })
                  }
                  className="mt-1"
                  placeholder="piece, box, liter, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Unit Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unit_price: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label>Stock Quantity *</Label>
                <Input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock_quantity: parseInt(e.target.value) || 0,
                    })
                  }
                  className="mt-1"
                  required
                  disabled={!!product}
                />
                {product && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use stock adjustment to change
                  </p>
                )}
              </div>
              <div>
                <Label>Min Stock Level</Label>
                <Input
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_stock_level: parseInt(e.target.value) || 0,
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
              />
              <Label htmlFor="is_active">Active Product</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Product'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StockAdjustmentDialog({
  product,
  onClose,
  onSave,
}: {
  product: InventoryProduct;
  onClose: () => void;
  onSave: (newStock: number) => void;
}) {
  const [stockQuantity, setStockQuantity] = useState(product.stock_quantity);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleIncrement = () => setStockQuantity((prev) => prev + 1);
  const handleDecrement = () => setStockQuantity((prev) => Math.max(0, prev - 1));
  
  const adjustment = stockQuantity - product.stock_quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustment === 0) {
      onClose();
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/inventory/products/${product.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment, notes: notes || 'Stock adjustment via UI' }),
      });

      if (res.ok) {
        onSave(stockQuantity);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to adjust stock');
      }
    } catch (error) {
      console.error('Error adjusting stock:', error);
      alert('Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Manage Stock - {product.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground mb-2">Current Stock</p>
              <p className="text-2xl font-bold text-center">
                {product.stock_quantity} {product.unit_of_measure || 'pcs'}
              </p>
            </div>

            <div>
              <Label>New Stock Quantity</Label>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleDecrement}
                  disabled={stockQuantity <= 0}
                  className="w-12 h-12 text-xl"
                >
                  −
                </Button>
                <Input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= 0) {
                      setStockQuantity(value);
                    }
                  }}
                  className="text-center text-lg font-semibold h-12"
                  min="0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleIncrement}
                  className="w-12 h-12 text-xl"
                >
                  +
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Unit: {product.unit_of_measure || 'pieces'}
              </p>
            </div>

            {adjustment !== 0 && (
              <div className={`rounded-lg p-3 ${adjustment > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className="text-sm text-muted-foreground">Change</p>
                <p className={`text-xl font-bold ${adjustment > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {adjustment > 0 ? '+' : ''}{adjustment} {product.unit_of_measure || 'pcs'}
                </p>
              </div>
            )}

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
                placeholder="Reason for adjustment..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : adjustment === 0 ? 'Close' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
