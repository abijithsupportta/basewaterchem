'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit, Phone, Mail, MapPin,
  Package, Wrench, ShieldCheck, AlertCircle, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor, formatPhone } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS, AMC_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [customerProducts, setCustomerProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [amcContracts, setAmcContracts] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    const fetchAll = async () => {
      setLoading(true);
      const [custRes, cpRes, srvRes, amcRes, cmpRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('customer_products').select('*, product:products(*)').eq('customer_id', id),
        supabase.from('services').select('*, assigned_to_staff:staff(full_name)').eq('customer_id', id).order('scheduled_date', { ascending: false }).limit(10),
        supabase.from('amc_contracts').select('*, product:products(name)').eq('customer_id', id).order('created_at', { ascending: false }),
        supabase.from('complaints').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(10),
      ]);
      if (custRes.data) setCustomer(custRes.data);
      if (cpRes.data) setCustomerProducts(cpRes.data);
      if (srvRes.data) setServices(srvRes.data);
      if (amcRes.data) setAmcContracts(amcRes.data);
      if (cmpRes.data) setComplaints(cmpRes.data);
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

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Products ({customerProducts.length})</CardTitle>
          <Link href={`/dashboard/customers/${id}/add-product`}><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> Add</Button></Link>
        </CardHeader>
        <CardContent>
          {customerProducts.length === 0 ? <p className="text-sm text-muted-foreground">No products installed</p> : (
            <div className="space-y-3">
              {customerProducts.map((cp: any) => (
                <div key={cp.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div><p className="font-medium">{cp.product?.name || 'Product'}</p><p className="text-sm text-muted-foreground">Installed: {formatDate(cp.installation_date)} | Serial: {cp.serial_number || 'N/A'}</p></div>
                  <Badge variant={new Date(cp.warranty_end_date) > new Date() ? 'default' : 'secondary'}>{new Date(cp.warranty_end_date) > new Date() ? 'In Warranty' : 'Expired'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> AMC Contracts ({amcContracts.length})</CardTitle>
          <Link href={`/dashboard/amc/new?customer=${id}`}><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> New AMC</Button></Link>
        </CardHeader>
        <CardContent>
          {amcContracts.length === 0 ? <p className="text-sm text-muted-foreground">No AMC contracts</p> : (
            <div className="space-y-3">
              {amcContracts.map((amc: any) => (
                <Link key={amc.id} href={`/dashboard/amc/${amc.id}`} className="block">
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                    <div><p className="font-medium">{amc.contract_number}</p><p className="text-sm text-muted-foreground">{formatDate(amc.start_date)} → {formatDate(amc.end_date)} | {amc.services_completed}/{amc.total_services_included} services</p></div>
                    <Badge className={getStatusColor(amc.status)}>{AMC_STATUS_LABELS[amc.status as keyof typeof AMC_STATUS_LABELS] || amc.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                    <Badge className={getStatusColor(srv.status)}>{SERVICE_STATUS_LABELS[srv.status as keyof typeof SERVICE_STATUS_LABELS] || srv.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Complaints ({complaints.length})</CardTitle>
          <Link href={`/dashboard/complaints/new?customer=${id}`}><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> New</Button></Link>
        </CardHeader>
        <CardContent>
          {complaints.length === 0 ? <p className="text-sm text-muted-foreground">No complaints</p> : (
            <div className="space-y-3">
              {complaints.map((cmp: any) => (
                <Link key={cmp.id} href={`/dashboard/complaints/${cmp.id}`} className="block">
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent">
                    <div><p className="font-medium">{cmp.complaint_number}</p><p className="text-sm text-muted-foreground">{cmp.subject} | {formatDate(cmp.created_at)}</p></div>
                    <Badge className={getStatusColor(cmp.status)}>{cmp.status}</Badge>
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
