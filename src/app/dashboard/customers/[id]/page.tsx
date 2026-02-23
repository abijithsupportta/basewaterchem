'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit, Phone, Mail, MapPin,
  Wrench, Plus, FileText, Package, CheckCircle, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor, getEffectiveServiceStatus, formatPhone } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [amcContracts, setAmcContracts] = useState<any[]>([]);
  const [endingAmc, setEndingAmc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    const fetchAll = async () => {
      setLoading(true);
      const [custRes, srvRes, invRes, amcRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('services').select('*').eq('customer_id', id).order('scheduled_date', { ascending: false }).limit(10),
        supabase.from('invoices').select('*, items:invoice_items(*)').eq('customer_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('amc_contracts').select('*, invoice:invoices(invoice_number, invoice_date)').eq('customer_id', id).order('created_at', { ascending: false }),
      ]);
      if (custRes.data) setCustomer(custRes.data);
      if (srvRes.data) setServices(srvRes.data);
      if (invRes.data) {
        setInvoices(invRes.data);
        // Collect all unique products/items from invoices
        const allItems = invRes.data.flatMap((inv: any) => (inv.items || []).map((item: any) => ({
          ...item,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
        })));
        setInvoiceItems(allItems);
      }
      if (amcRes.data) setAmcContracts(amcRes.data);
      setLoading(false);
    };
    fetchAll();
  }, [id]);

  if (loading) return <Loading />;
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Customer not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/customers')}>Back to Customers</Button>
      </div>
    );
  }

  const handleEndAmc = async (amcId: string) => {
    if (!window.confirm('Mark this AMC as completed? No more recurring services will be scheduled.')) return;
    
    setEndingAmc(amcId);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase
        .from('amc_contracts')
        .update({ status: 'completed', end_date: new Date().toISOString().split('T')[0] })
        .eq('id', amcId);
      
      if (error) throw error;
      
      setAmcContracts(amcContracts.map(amc => 
        amc.id === amcId ? { ...amc, status: 'completed', end_date: new Date().toISOString().split('T')[0] } : amc
      ));
      toast.success('AMC marked as completed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to end AMC');
    } finally {
      setEndingAmc(null);
    }
  };

  const getAmcProgress = (amc: any) => {
    // Count completed/in_progress services for this AMC
    const completedCount = services.filter(s => 
      s.amc_contract_id === amc.id && ['completed', 'in_progress'].includes(s.status)
    ).length;
    const totalServices = amc.total_services_included || 1;
    return { completedCount, totalServices };
  };

  const getAmcEndDate = (amc: any) => {
    if (amc.end_date) return amc.end_date;
    if (amc.next_service_date) return amc.next_service_date;
    // Calculate expected end based on interval
    const start = new Date(amc.start_date);
    const months = amc.service_interval_months * (amc.total_services_included || 1);
    start.setMonth(start.getMonth() + months);
    return start.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/customers')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{customer.full_name}</h1>
            <p className="text-muted-foreground">{customer.customer_code}</p>
          </div>
          <Badge variant={customer.is_active ? 'default' : 'secondary'}>{customer.is_active ? 'Active' : 'Inactive'}</Badge>
        </div>
        <Link href={`/dashboard/customers/${id}/edit`}><Button><Edit className="mr-2 h-4 w-4" /> Edit</Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 pt-6"><Phone className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Phone</p><p className="font-medium">{formatPhone(customer.phone)}</p>{customer.alt_phone && <p className="text-sm">{formatPhone(customer.alt_phone)}</p>}</div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-6"><Mail className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{customer.email || 'Not provided'}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-6"><MapPin className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Location</p><p className="font-medium">{customer.city || 'Kottayam'}, {customer.district || 'Kottayam'}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
        <CardContent>
          <p>{customer.address_line1}</p>
          {customer.address_line2 && <p>{customer.address_line2}</p>}
          <p>{customer.city}, {customer.district}, {customer.state} - {customer.pincode}</p>
          {customer.location_landmark && <p className="text-muted-foreground mt-1">Landmark: {customer.location_landmark}</p>}
        </CardContent>
      </Card>

      {/* Products / Items purchased */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Products &amp; Items ({invoiceItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invoiceItems.length === 0 ? <p className="text-sm text-muted-foreground">No products purchased yet</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="pb-2 font-medium">Item</th><th className="pb-2 font-medium">Description</th><th className="pb-2 font-medium text-right">Qty</th><th className="pb-2 font-medium text-right">Price</th><th className="pb-2 font-medium text-right">Total</th><th className="pb-2 font-medium">Invoice</th><th className="pb-2 font-medium">Date</th></tr></thead>
                <tbody>
                  {invoiceItems.map((item: any, idx: number) => (
                    <tr key={item.id || idx} className="border-b">
                      <td className="py-2 font-medium">{item.item_name || '-'}</td>
                      <td className="py-2 text-muted-foreground">{item.description}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="py-2 text-right">{formatCurrency(item.total_price)}</td>
                      <td className="py-2 text-blue-600">{item.invoice_number}</td>
                      <td className="py-2 text-muted-foreground">{formatDate(item.invoice_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AMC Services */}
      {amcContracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Recurring Services (AMC) - {amcContracts.filter(a => a.status === 'active').length} Active
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {amcContracts.map((amc: any) => {
              const { completedCount, totalServices } = getAmcProgress(amc);
              const progress = (completedCount / totalServices) * 100;
              const expectedEnd = getAmcEndDate(amc);
              const isExpired = new Date(expectedEnd) < new Date() && amc.status === 'active';

              return (
                <div key={amc.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">Invoice: {amc.invoice?.invoice_number || amc.invoice_id}</p>
                      <p className="text-sm text-muted-foreground">
                        {amc.service_interval_months}-month interval • {amc.total_services_included} total services
                      </p>
                    </div>
                    <Badge 
                      variant={amc.status === 'active' ? 'default' : 'secondary'}
                      className={isExpired ? 'bg-red-600' : ''}
                    >
                      {amc.status === 'active' && isExpired ? 'Expired' : (amc.status === 'completed' ? 'Completed' : 'Active')}
                    </Badge>
                  </div>

                  {/* Service Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Services Completed</span>
                      <span className="text-sm font-medium">{completedCount} / {totalServices}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Started</p>
                      <p className="font-medium">{formatDate(amc.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Next Service</p>
                      <p className="font-medium">{formatDate(amc.next_service_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expected End</p>
                      <p className={`font-medium ${isExpired ? 'text-red-600' : ''}`}>
                        {formatDate(expectedEnd)}
                        {isExpired && <span className="ml-1 text-xs">⚠️</span>}
                      </p>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-sm">
                    <p className="text-muted-foreground">Contract Amount</p>
                    <p className="font-medium text-lg">{formatCurrency(amc.amount)}</p>
                  </div>

                  {/* Actions */}
                  {amc.status === 'active' && (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => router.push(`/dashboard/services?amc=${amc.id}`)}
                      >
                        View Services
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleEndAmc(amc.id)}
                        disabled={endingAmc === amc.id}
                      >
                        {endingAmc === amc.id ? 'Ending...' : 'End AMC'}
                      </Button>
                    </div>
                  )}

                  {amc.status === 'completed' && amc.end_date && (
                    <p className="text-sm text-muted-foreground">
                      Completed on {formatDate(amc.end_date)}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" /> Recent Services ({services.length})</CardTitle>
          <Link href={`/dashboard/services/new?customer=${id}`}><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> New</Button></Link>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? <p className="text-sm text-muted-foreground">No services</p> : (
            <div className="space-y-3">
              {services.map((srv: any) => (
                <Link key={srv.id} href={`/dashboard/services/${srv.id}`} className="block">
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                    <div><p className="font-medium">{srv.service_number}</p><p className="text-sm text-muted-foreground">{SERVICE_TYPE_LABELS[srv.service_type as keyof typeof SERVICE_TYPE_LABELS]} | {formatDate(srv.scheduled_date)}</p></div>
                    <Badge className={getStatusColor(getEffectiveServiceStatus(srv.status, srv.scheduled_date))}>{SERVICE_STATUS_LABELS[getEffectiveServiceStatus(srv.status, srv.scheduled_date) as keyof typeof SERVICE_STATUS_LABELS] || srv.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Invoices ({invoices.length})</CardTitle>
          <Link href={`/dashboard/invoices/new?customer=${id}`}><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> New</Button></Link>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices</p> : (
            <div className="space-y-3">
              {invoices.map((inv: any) => (
                <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`} className="block">
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{inv.invoice_number}</p>
  
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(inv.invoice_date)} | {formatCurrency(inv.total_amount)} | {inv.items?.length || 0} items</p>
                    </div>
                    <Badge className={getStatusColor(inv.status)}>{inv.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {customer.notes && (
        <Card><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{customer.notes}</p></CardContent></Card>
      )}
    </div>
  );
}
