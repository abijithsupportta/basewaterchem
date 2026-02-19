'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar, Phone, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

export function OverdueServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchOverdue = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('services')
          .select(`
            *,
            customer:customers (id, full_name, phone, customer_code, city),
            customer_product:customer_products (
              id,
              product:products (name, brand)
            )
          `)
          .in('status', ['scheduled', 'assigned', 'rescheduled'])
          .lt('scheduled_date', today)
          .order('scheduled_date', { ascending: true })
          .limit(10);
        if (error) throw error;
        setServices(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOverdue();
  }, [supabase]);

  if (!loading && services.length === 0) return null;

  return (
    <Card className="border-red-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          Overdue Services
        </CardTitle>
        <Link href="/dashboard/services?status=overdue">
          <Button variant="ghost" size="sm">
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <Link
                key={service.id}
                href={`/dashboard/services/${service.id}`}
                className="block rounded-lg border border-red-100 bg-red-50/50 p-3 hover:bg-red-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="font-medium text-sm">{service.customer?.full_name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 text-red-600">
                        <Calendar className="h-3 w-3" />
                        {formatDate(service.scheduled_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {service.customer?.phone}
                      </span>
                    </div>
                    {service.customer_product?.product && (
                      <p className="text-xs text-muted-foreground">
                        {service.customer_product.product.name}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-red-600">
                    {service.service_number}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
