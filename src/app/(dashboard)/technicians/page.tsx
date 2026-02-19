'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wrench, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatPhone } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase/client';

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.from('staff').select('*').eq('role', 'technician').eq('is_active', true).order('full_name').then(({ data }) => {
      if (data) setTechnicians(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div><h1 className="text-2xl font-bold">Technicians</h1><p className="text-muted-foreground">{technicians.length} active technicians</p></div>

      {loading ? <Loading /> : technicians.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No technicians found</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {technicians.map((tech: any) => (
            <Link key={tech.id} href={`/dashboard/technicians/${tech.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div>
                    <div>
                      <p className="font-medium">{tech.full_name}</p>
                      <p className="text-sm text-muted-foreground">{formatPhone(tech.phone)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
