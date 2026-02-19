'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ComplaintRepository } from '@/infrastructure/repositories';
import { formatRelativeDate, getStatusColor } from '@/lib/utils';
import { COMPLAINT_PRIORITY_LABELS } from '@/lib/constants';
import type { ComplaintWithDetails } from '@/types';

export function RecentComplaints() {
  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const repo = useMemo(() => new ComplaintRepository(supabase), [supabase]);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const data = await repo.findRecent(5);
        setComplaints(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, [repo]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Open Complaints</CardTitle>
        <Link href="/dashboard/complaints">
          <Button variant="ghost" size="sm">
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : complaints.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No open complaints</p>
        ) : (
          <div className="space-y-3">
            {complaints.map((complaint) => (
              <Link
                key={complaint.id}
                href={`/dashboard/complaints/${complaint.id}`}
                className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{complaint.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {complaint.customer?.full_name} &bull; {complaint.complaint_number}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(complaint.priority)}`}>
                      {COMPLAINT_PRIORITY_LABELS[complaint.priority] || complaint.priority}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(complaint.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
