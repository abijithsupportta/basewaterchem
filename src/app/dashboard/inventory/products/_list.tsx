'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import Link from 'next/link';
import { Plus, Edit, Trash2, Package, AlertTriangle, Tag, Search, TrendingUp, ShoppingCart, Archive, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserRole } from '@/lib/use-user-role';
import { canDelete } from '@/lib/authz';
import type { InventoryCategory, InventoryProduct } from '@/types/inventory';

interface Stats {
  totalProducts: number;
  activeProducts: number;
  totalStockQuantity: number;
  totalStockValue: number;
  outOfStock: number;
  lowStock: number;
  totalCategories: number;
}

interface Props {
  products: InventoryProduct[];
  total: number;
  totalPages: number;
  currentPage: number;
  stats: Stats;
  categories: InventoryCategory[];
  initialQuery: string;
  initialCategory: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
function formatNumber(num: number) {
  return new Intl.NumberFormat('en-IN').format(num);
}

export function ProductsList({ products, total, totalPages, currentPage, stats, categories, initialQuery, initialCategory }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userRole = useUserRole();
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryProduct | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term.trim()) {
      params.set('q', term.trim());
    } else {
      params.delete('q');
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }, 300);

  const handleCategoryChange = (categoryId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (categoryId) {
      params.set('category', categoryId);
    } else {
      params.delete('category');
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleClearFilters = () => {
    router.push(pathname);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/inventory/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete product');
      }
    } catch {
      alert('Failed to delete product');
    }
  };

  const lowStockProducts = products.filter(
    (p) => p.is_active && p.min_stock_level && p.stock_quantity <= p.min_stock_level
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products & Inventory</h1>
          <p className="text-sm text-muted-foreground">Comprehensive inventory management and stock tracking</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/inventory/categories">
            <Button variant="outline"><Tag className="mr-2 h-4 w-4" /> Categories</Button>
          </Link>
          <Button onClick={() => { setEditingProduct(null); setShowProductDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold">{stats.totalProducts}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.activeProducts} active</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Stock Value</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalStockValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">Inventory worth</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Items in Stock</p>
              <p className="text-2xl font-bold">{formatNumber(stats.totalStockQuantity)}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.totalCategories} categories</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Archive className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Stock Alerts</p>
              <p className="text-2xl font-bold">{stats.lowStock + stats.outOfStock}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.lowStock} low, {stats.outOfStock} out</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </CardContent></Card>
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
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {lowStockProducts.map((product) => (
                <button key={product.id} onClick={() => { setAdjustingProduct(product); setShowStockDialog(true); }}
                  className="flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-1.5 hover:bg-amber-50 transition-colors">
                  <span className="text-sm font-medium">{product.name}</span>
                  <Badge variant="outline" className="text-amber-700 border-amber-300">{product.stock_quantity} {product.unit_of_measure || 'pcs'}</Badge>
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
                defaultValue={initialQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-64">
              <select
                value={initialCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            {(initialQuery || initialCategory) && (
              <Button variant="outline" onClick={handleClearFilters}>Clear</Button>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing:</span>
            <span className="font-semibold text-foreground">{total}</span>
            <span>products</span>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {initialQuery || initialCategory ? 'No products match your search criteria' : 'No products yet. Click "Add Product" to get started.'}
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
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{product.sku || 'N/A'}</code>
                      </td>
                      <td className="py-3 px-4">
                        {product.category ? (
                          <Badge variant="outline" className="font-normal">{product.category.name}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Uncategorized</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{formatCurrency(product.unit_price)}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => { setAdjustingProduct(product); setShowStockDialog(true); }}
                          className="hover:bg-muted rounded px-3 py-1.5 transition-colors inline-flex items-center gap-2" title="Click to manage stock">
                          <span className={`font-semibold text-sm ${product.min_stock_level && product.stock_quantity <= product.min_stock_level ? 'text-amber-600' : 'text-foreground'}`}>
                            {product.stock_quantity}
                          </span>
                          <span className="text-xs text-muted-foreground">{product.unit_of_measure || 'pcs'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={product.is_active ? 'default' : 'secondary'} className="text-xs">
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingProduct(product); setShowProductDialog(true); }} title="Edit product">
                            <Edit className="h-4 w-4" />
                          </Button>
                          {canDelete(userRole) && (
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteProduct(product.id)} title="Delete product">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} &mdash; {total} total products
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isPending}>
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, index, array) => (
                      <div key={p} className="flex items-center">
                        {index > 0 && array[index - 1] !== p - 1 && <span className="px-2 text-muted-foreground">...</span>}
                        <Button variant={currentPage === p ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(p)} className="min-w-[40px]" disabled={isPending}>
                          {p}
                        </Button>
                      </div>
                    ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || isPending}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showProductDialog && (
        <ProductDialog
          product={editingProduct}
          categories={categories}
          onClose={() => { setShowProductDialog(false); setEditingProduct(null); }}
          onSave={() => { setShowProductDialog(false); setEditingProduct(null); router.refresh(); }}
        />
      )}

      {showStockDialog && adjustingProduct && (
        <StockAdjustmentDialog
          product={adjustingProduct}
          onClose={() => { setShowStockDialog(false); setAdjustingProduct(null); }}
          onSave={() => { setShowStockDialog(false); setAdjustingProduct(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ProductDialog({ product, categories, onClose, onSave }: {
  product: InventoryProduct | null;
  categories: InventoryCategory[];
  onClose: () => void;
  onSave: () => void;
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
      const url = product ? `/api/inventory/products/${product.id}` : '/api/inventory/products';
      const method = product ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, category_id: formData.category_id || null }) });
      if (res.ok) {
        onSave();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save product');
      }
    } catch {
      alert('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader><CardTitle>{product ? 'Edit' : 'Add'} Product</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Product Name *</Label>
                <Input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1" required />
              </div>
              <div>
                <Label>SKU (Optional)</Label>
                <Input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} className="mt-1" placeholder="Leave empty if not applicable" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="mt-1 w-full rounded-md border p-2">
                  <option value="">No Category</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Unit of Measure</Label>
                <Input type="text" value={formData.unit_of_measure} onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })} className="mt-1" placeholder="piece, box, liter, etc." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Unit Price *</Label>
                <Input type="number" step="0.01" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} className="mt-1" required />
              </div>
              <div>
                <Label>Stock Quantity *</Label>
                <Input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })} className="mt-1" required disabled={!!product} />
                {product && <p className="mt-1 text-xs text-muted-foreground">Use stock adjustment to change</p>}
              </div>
              <div>
                <Label>Min Stock Level</Label>
                <Input type="number" value={formData.min_stock_level} onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
              <Label htmlFor="is_active">Active Product</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StockAdjustmentDialog({ product, onClose, onSave }: {
  product: InventoryProduct;
  onClose: () => void;
  onSave: () => void;
}) {
  const [stockQuantity, setStockQuantity] = useState(product.stock_quantity);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const adjustment = stockQuantity - product.stock_quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustment === 0) { onClose(); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/products/${product.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment, notes: notes || 'Stock adjustment via UI' }),
      });
      if (res.ok) {
        onSave();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to adjust stock');
      }
    } catch {
      alert('Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Manage Stock - {product.name}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground mb-2">Current Stock</p>
              <p className="text-2xl font-bold text-center">{product.stock_quantity} {product.unit_of_measure || 'pcs'}</p>
            </div>
            <div>
              <Label>New Stock Quantity</Label>
              <div className="flex items-center gap-2 mt-2">
                <Button type="button" variant="outline" size="lg" onClick={() => setStockQuantity((p) => Math.max(0, p - 1))} disabled={stockQuantity <= 0} className="w-12 h-12 text-xl">−</Button>
                <Input type="number" value={stockQuantity} onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) setStockQuantity(v); }} className="text-center text-lg font-semibold h-12" min="0" />
                <Button type="button" variant="outline" size="lg" onClick={() => setStockQuantity((p) => p + 1)} className="w-12 h-12 text-xl">+</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground text-center">Unit: {product.unit_of_measure || 'pieces'}</p>
            </div>
            {adjustment !== 0 && (
              <div className={`rounded-lg p-3 ${adjustment > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className="text-sm text-muted-foreground">Change</p>
                <p className={`text-xl font-bold ${adjustment > 0 ? 'text-green-700' : 'text-red-700'}`}>{adjustment > 0 ? '+' : ''}{adjustment} {product.unit_of_measure || 'pcs'}</p>
              </div>
            )}
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} placeholder="Reason for adjustment..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : adjustment === 0 ? 'Close' : 'Save Changes'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
