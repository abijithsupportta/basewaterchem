'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, getStatusColor } from '@/lib/utils';
import { COMPLAINT_STATUS_LABELS, COMPLAINT_PRIORITY_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    supabase
      .from('complaints')
      .select('*, customer:customers(*), customer_product:customer_products(*, product:products(name)), assigned_to_staff:staff(full_name, phone)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setComplaint(data);
        setLoading(false);
      });
  }, [id]);

  const handleResolve = async () => {
    setResolving(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('complaints').update({
        status: 'resolved',
        resolution_notes: resolution,
        resolved_date: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      toast.success('Complaint resolved!');
      setComplaint((c: any) => ({ ...c, status: 'resolved', resolution_notes: resolution }));
      setShowResolveForm(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to resolve');
    } finally {
      setResolving(false);
    }
  };

  if (loading) return <Loading />;
  if (!complaint) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Complaint not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/complaints')}>Back to Complaints</Button>
      </div>
    );
  }

  const customer = complaint.customer as any;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{complaint.complaint_number}</h1>
            <p className="text-muted-foreground">{complaint.subject}</p>
          </div>
          <Badge className={getStatusColor(complaint.status)}>{COMPLAINT_STATUS_LABELS[complaint.status as keyof typeof COMPLAINT_STATUS_LABELS]}</Badge>
          <Badge variant={complaint.priority === 'high' || complaint.priority === 'urgent' ? 'destructive' : 'outline'}>
            {COMPLAINT_PRIORITY_LABELS[complaint.priority as keyof typeof COMPLAINT_PRIORITY_LABELS]}
          </Badge>
        </div>
        {complaint.status !== 'resolved' && complaint.status !== 'closed' && (
          <Button onClick={() => setShowResolveForm(true)}><CheckCircle className="mr-2 h-4 w-4" /> Resolve</Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
          <CardContent>
            {customer && (
              <Link href={`/dashboard/customers/${customer.id}`} className="hover:underline">
                <p className="font-medium">{customer.full_name}</p>
                <p className="text-sm text-muted-foreground">{customer.customer_code} | {customer.phone}</p>
                <p className="text-sm text-muted-foreground">{customer.city}</p>
              </Link>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm"><span className="text-muted-foreground">Filed:</span> {formatDate(complaint.created_at)}</p>
            {complaint.customer_product && <p className="text-sm"><span className="text-muted-foreground">Product:</span> {(complaint.customer_product as any)?.product?.name}</p>}
            {complaint.assigned_to_staff && <p className="text-sm"><span className="text-muted-foreground">Assigned to:</span> {(complaint.assigned_to_staff as any)?.full_name}</p>}
            {complaint.resolved_date && <p className="text-sm"><span className="text-muted-foreground">Resolved:</span> {formatDate(complaint.resolved_date)}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap">{complaint.description}</p></CardContent>
      </Card>

      {complaint.resolution_notes && (
        <Card className="border-green-200">
          <CardHeader><CardTitle className="text-base text-green-700">Resolution</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap">{complaint.resolution_notes}</p></CardContent>
        </Card>
      )}

      {showResolveForm && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader><CardTitle className="text-base text-green-800">Resolve Complaint</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Resolution Notes *</Label>
              <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe how the complaint was resolved..." rows={4} />
            </div>
            <div className="flex gap-4">
              <Button onClick={handleResolve} disabled={resolving || !resolution}>{resolving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark Resolved</Button>
              <Button variant="outline" onClick={() => setShowResolveForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
