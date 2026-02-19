'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Phone, User, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ServiceRepository } from '@/infrastructure/repositories';
import { formatDate, getStatusColor, getServiceTypeLabel } from '@/lib/utils';
import type { ServiceWithDetails } from '@/types';

export function UpcomingServices() {
  const [services, setServices] = useState<ServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const repo = useMemo(() => new ServiceRepository(supabase), [supabase]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await repo.findUpcoming(10);
        setServices(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [repo]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Upcoming Services</CardTitle>
        <Link href="/dashboard/services/upcoming">
          <Button variant="ghost" size="sm">
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No upcoming services</p>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <Link
                key={service.id}
                href={`/dashboard/services/${service.id}`}
                className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{service.customer?.full_name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(service.service_type)}`}>
                        {getServiceTypeLabel(service.service_type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(service.scheduled_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {service.customer?.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {service.customer?.city}
                      </span>
                    </div>
                  </div>
                  {service.technician ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <User className="h-3 w-3" />
                      {service.technician.full_name}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">Unassigned</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
