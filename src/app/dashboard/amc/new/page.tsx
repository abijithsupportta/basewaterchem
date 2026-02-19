'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';

export default function NewAMCPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <h1 className="text-2xl font-bold">Create AMC Contract</h1>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">AMC contracts are created from Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To create an AMC contract, create a new invoice and enable the &quot;AMC Contract&quot; option.
            This will automatically create an AMC contract linked to the invoice and schedule the service.
          </p>
          <div className="flex gap-3">
            <Link href="/dashboard/invoices/new">
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                Create Invoice with AMC
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
