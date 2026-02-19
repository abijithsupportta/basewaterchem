'use client';

import { StatsCards } from '@/components/dashboard/stats-cards';
import { UpcomingServices } from '@/components/dashboard/upcoming-services';
import { OverdueServices } from '@/components/dashboard/overdue-services';
import { RecentComplaints } from '@/components/dashboard/recent-complaints';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your service operations</p>
      </div>

      <StatsCards />

      <OverdueServices />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingServices />
        <RecentComplaints />
      </div>
    </div>
  );
}
