'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import Link from 'next/link';
import { History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { formatDate, formatCurrency, isFreeServiceActive, getFreeServiceValidUntil } from '@/lib/utils';
import { SERVICE_TYPE_LABELS } from '@/lib/constants';

function isAutoCreatedService(service: any): boolean {
  return Boolean(service?.amc_contract_id) && !service?.created_by_staff_id;
}

interface Props {
  services: any[];
  total: number;
  totalPages: number;
  currentPage: number;
  initialQuery: string;
}

export function ServiceHistoryList({ services, total, totalPages, currentPage, initialQuery }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Service History</h1>
          <p className="text-muted-foreground">{total} completed service{total !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/services"><Button variant="outline">All Services</Button></Link>
      </div>

      <SearchBar value={initialQuery} onChange={handleSearch} placeholder="Search history..." />

      {isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : services.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <History className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No completed services found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {services.map((s: any) => (
            <Link key={s.id} href={`/dashboard/services/${s.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{s.service_number} - {(s.customer as any)?.full_name}</p>
                      {isAutoCreatedService(s) && <Badge variant="outline" className="text-xs">Created Automatically</Badge>}
                      {isFreeServiceActive(s) && (
                        <>
                          <Badge className="bg-emerald-100 text-emerald-800">Free Service</Badge>
                          {getFreeServiceValidUntil(s) && (
                            <span className="text-xs text-muted-foreground">Free until: {formatDate(getFreeServiceValidUntil(s)!)}</span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.service_type === 'free_service' && !isFreeServiceActive(s)
                        ? 'Paid Service'
                        : SERVICE_TYPE_LABELS[s.service_type as keyof typeof SERVICE_TYPE_LABELS]} | Completed: {formatDate(s.completed_date)}
                      {s.actual_amount > 0 && <> | {formatCurrency(s.actual_amount)}</>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created by: {s.created_by_staff_name || 'Unknown'} | Completed by: {s.completed_by_staff_name || 'Unknown'}
                    </p>
                  </div>
                  <Badge variant="default">Completed</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1 || isPending}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages || isPending}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
