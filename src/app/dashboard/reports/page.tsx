'use client';

import Link from 'next/link';
import { BarChart3, Wrench, ShieldCheck, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/layout/breadcrumb';

export default function ReportsPage() {
  const reports = [
    { title: 'Service Report', description: 'Overview of all services, completion rates, and technician performance', icon: Wrench, href: '/dashboard/reports/service-report' },
    { title: 'AMC Report', description: 'AMC contract status, renewals due, and service coverage', icon: ShieldCheck, href: '/dashboard/reports/amc-report' },
    { title: 'Revenue Report', description: 'Revenue from services, AMCs, and product sales', icon: IndianRupee, href: '/dashboard/reports/revenue-report' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-muted-foreground">Business analytics and insights</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.title} href={report.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <report.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">{report.title}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{report.description}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
