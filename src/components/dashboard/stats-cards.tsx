'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Users, FileCheck, Wrench, Clock,
  Calendar, CreditCard, TrendingUp, IndianRupee
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DashboardRepository } from '@/infrastructure/repositories';
import type { DashboardStats } from '@/types';
import { formatCurrency } from '@/lib/utils';

const defaultStats: DashboardStats = {
  total_customers: 0,
  active_amc_contracts: 0,
  todays_services: 0,
  overdue_services: 0,
  this_week_services: 0,
  amc_expiring_soon: 0,
  pending_payments: 0,
  amc_services_this_month: 0,
  amc_services_this_week: 0,
  revenue_this_month: 0,
};

export function StatsCards() {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const repo = useMemo(() => new DashboardRepository(supabase), [supabase]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await repo.getStats();
        setStats(data);
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [repo]);

  const cards = [
    { title: 'Total Customers', value: stats.total_customers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Active AMC', value: stats.active_amc_contracts, icon: FileCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'AMC This Month', value: stats.amc_services_this_month, icon: Calendar, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'AMC This Week', value: stats.amc_services_this_week, icon: TrendingUp, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { title: "Today's Services", value: stats.todays_services, icon: Wrench, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Overdue Services', value: stats.overdue_services, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'AMC Expiring', value: stats.amc_expiring_soon, icon: FileCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'Revenue This Month', value: formatCurrency(stats.revenue_this_month), icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50', isFormatted: true },
    { title: 'Pending Payments', value: stats.pending_payments, icon: CreditCard, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg p-3 ${card.bg}`}>
                <Icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold">
                  {loading ? '...' : card.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
