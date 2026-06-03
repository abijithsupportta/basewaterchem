'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Package, DollarSign, Archive, AlertTriangle, 
  Settings, Loader2, Plus, Calendar, FileText, Wrench, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loading } from '@/components/ui/loading';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useUserRole } from '@/lib/use-user-role';
import { canCreateOrEdit } from '@/lib/authz';
import { toast } from 'sonner';
import type { InventoryProduct, StockTransaction } from '@/types/inventory';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const userRole = useUserRole();
  const canManage = canCreateOrEdit(userRole as any);

  const [product, setProduct] = useState<InventoryProduct | null>(null);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  
  const [adjustmentVal, setAdjustmentVal] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');

  const fetchProductAndTransactions = async () => {
    if (!id) return;
    try {
      const [prodRes, txRes] = await Promise.all([
        fetch(`/api/inventory/products/${id}`),
        fetch(`/api/inventory/products/${id}/transactions?limit=100`),
      ]);

      if (!prodRes.ok) throw new Error('Failed to load product');
      if (!txRes.ok) throw new Error('Failed to load transactions');

      const prodData = await prodRes.json();
      const txData = await txRes.json();

      setProduct(prodData);
      setTransactions(txData);
    } catch (err: any) {
      toast.error(err.message || 'Error loading product information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void fetchProductAndTransactions();
  }, [id]);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !canManage) return;

    const adjustment = parseInt(adjustmentVal, 10);
    if (isNaN(adjustment) || adjustment === 0) {
      toast.error('Please enter a valid non-zero adjustment quantity');
      return;
    }

    setAdjusting(true);
    try {
      const res = await fetch(`/api/inventory/products/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustment,
          notes: adjustmentNotes.trim() || 'Manual stock adjustment via details view',
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || 'Failed to adjust stock');
      }

      toast.success('Stock adjusted successfully');
      setAdjustmentVal('');
      setAdjustmentNotes('');
      await fetchProductAndTransactions();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) return <Loading />;
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Package className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Product not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/inventory/products')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
        </Button>
      </div>
    );
  }

  const isLowStock = product.is_active && product.min_stock_level && product.stock_quantity <= product.min_stock_level;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/dashboard/inventory/products')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
              <Badge variant={product.is_active ? 'default' : 'secondary'}>
                {product.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {isLowStock && (
                <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Low Stock
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              SKU: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono font-medium">{product.sku || 'N/A'}</code>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Product Info & Adjustment Form */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Unit Price</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{formatCurrency(product.unit_price)}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Current Stock Level</p>
                <p className={`text-lg font-bold mt-0.5 ${isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {product.stock_quantity} <span className="text-xs text-muted-foreground font-normal">({product.unit_of_measure || 'pieces'} available)</span>
                </p>
              </div>

              {product.min_stock_level !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Minimum Threshold</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{product.min_stock_level} {product.unit_of_measure || 'pieces'}</p>
                </div>
              )}

              {product.category && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Category</p>
                  <Badge variant="secondary" className="mt-1">{product.category.name}</Badge>
                </div>
              )}

              {product.description && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Description</p>
                  <p className="text-sm text-foreground mt-1 bg-muted/30 p-2.5 rounded border border-border/50 text-wrap whitespace-pre-wrap">{product.description}</p>
                </div>
              )}

              {product.notes && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Admin Notes</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">{product.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Adjustments */}
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" /> Stock Adjustment
                </CardTitle>
                <CardDescription>Manually add or remove stock quantities</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAdjustStock} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adjustmentQty">Adjustment Quantity</Label>
                    <Input 
                      id="adjustmentQty"
                      type="number"
                      placeholder="e.g. +10 to add, -5 to deduct"
                      value={adjustmentVal}
                      onChange={(e) => setAdjustmentVal(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adjustmentNotes">Notes / Reason</Label>
                    <Textarea 
                      id="adjustmentNotes"
                      placeholder="Reason for adjustment (e.g. damaged stock, purchase entry)"
                      value={adjustmentNotes}
                      onChange={(e) => setAdjustmentNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={adjusting}>
                    {adjusting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Apply Adjustment
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Ledger History */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Transaction Ledger History
              </CardTitle>
              <CardDescription>Track where this product was consumed in sales, service work, or adjusted manually</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {transactions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
                  <Archive className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm">No transaction records found for this product</p>
                </div>
              ) : (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="py-2.5 px-4 text-left font-medium text-xs">Date</th>
                        <th className="py-2.5 px-4 text-left font-medium text-xs">Type</th>
                        <th className="py-2.5 px-4 text-right font-medium text-xs">Qty Change</th>
                        <th className="py-2.5 px-4 text-left font-medium text-xs">Linked Reference</th>
                        <th className="py-2.5 px-4 text-left font-medium text-xs">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transactions.map((tx) => {
                        const isDeduction = tx.quantity < 0;
                        const formattedDelta = isDeduction ? `${tx.quantity}` : `+${tx.quantity}`;
                        
                        // Decide reference details
                        let refLink: React.ReactNode = <span className="text-xs text-muted-foreground">Manual / System</span>;
                        if (tx.reference_type === 'invoice' && tx.reference_id) {
                          refLink = (
                            <Link 
                              href={`/dashboard/invoices/${tx.reference_id}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium text-xs"
                            >
                              <FileText className="h-3 w-3" /> Invoice {tx.notes?.match(/INV-\d+/) || 'Detail'}
                            </Link>
                          );
                        } else if (tx.reference_type === 'service' && tx.reference_id) {
                          refLink = (
                            <Link 
                              href={`/dashboard/services/${tx.reference_id}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium text-xs"
                            >
                              <Wrench className="h-3 w-3" /> Service {tx.notes?.match(/SRV-\d+/) || 'Detail'}
                            </Link>
                          );
                        } else if (tx.reference_type === 'manual') {
                          refLink = <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-200/50">Manual Adj.</span>;
                        }

                        return (
                          <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(tx.created_at)}
                            </td>
                            <td className="py-3 px-4">
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] py-0 px-1.5 capitalize font-medium ${
                                  tx.transaction_type === 'sale' 
                                    ? 'border-green-300 text-green-700 bg-green-50/50' 
                                    : tx.transaction_type === 'service'
                                    ? 'border-blue-300 text-blue-700 bg-blue-50/50'
                                    : tx.transaction_type === 'adjustment'
                                    ? 'border-amber-300 text-amber-700 bg-amber-50/50'
                                    : 'border-slate-300 text-slate-700 bg-slate-50/50'
                                }`}
                              >
                                {tx.transaction_type}
                              </Badge>
                            </td>
                            <td className={`py-3 px-4 text-right font-semibold text-xs whitespace-nowrap ${isDeduction ? 'text-red-600' : 'text-green-600'}`}>
                              {formattedDelta}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {refLink}
                            </td>
                            <td className="py-3 px-4 text-xs max-w-[200px] truncate text-muted-foreground" title={tx.notes || ''}>
                              {tx.notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
