'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, FileCheck } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';
import { AMC_STATUS_LABELS } from '@/lib/constants';

export function AmcOverview() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAmc = async () => {
      try {
        const supabase = createBrowserClient();
        const { data } = await supabase
          .from('amc_contracts')
          .select('*, customer:customers(full_name, customer_code)')
          .in('status', ['active', 'pending_renewal'])
          .order('end_date', { ascending: true })
          .limit(5);
        setContracts(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAmc();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-purple-600" />
          AMC Contracts
        </CardTitle>
        <Link href="/dashboard/amc">
          <Button variant="ghost" size="sm">
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No active AMC contracts</p>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => {
              const daysLeft = Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <Link
                  key={contract.id}
                  href={`/dashboard/amc/${contract.id}`}
                  className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{contract.customer?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {contract.contract_number} &bull; Expires {formatDate(contract.end_date)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={getStatusColor(contract.status)} variant="outline">
                        {AMC_STATUS_LABELS[contract.status as keyof typeof AMC_STATUS_LABELS] || contract.status}
                      </Badge>
                      {daysLeft <= 30 && daysLeft > 0 && (
                        <span className="text-xs text-amber-600 font-medium">{daysLeft}d left</span>
                      )}
                      {daysLeft <= 0 && (
                        <span className="text-xs text-red-600 font-medium">Expired</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
