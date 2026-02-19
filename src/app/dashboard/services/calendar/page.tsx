'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarDays, Wrench, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Loading } from '@/components/ui/loading';
import { formatDate, formatCurrency, getStatusColor, cn } from '@/lib/utils';
import { SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from '@/lib/constants';
import { createBrowserClient } from '@/lib/supabase/client';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ServiceDay {
  date: string;
  services: any[];
  amcCount: number;
  paidCount: number;
  installationCount: number;
  totalCount: number;
}

export default function CalendarPage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split('T')[0]);

  // Fetch services for the current month
  const fetchServices = useCallback(async () => {
    setLoading(true);
    const supabase = createBrowserClient();
    const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
    const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

    const { data } = await supabase
      .from('services')
      .select('*, customer:customers(id, full_name, customer_code, phone, city)')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true });

    setServices(data || []);
    setLoading(false);
  }, [currentMonth, currentYear]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  // Build a map of date -> services
  const dayMap = useMemo(() => {
    const map: Record<string, ServiceDay> = {};
    for (const svc of services) {
      const date = svc.scheduled_date;
      if (!map[date]) {
        map[date] = { date, services: [], amcCount: 0, paidCount: 0, installationCount: 0, totalCount: 0 };
      }
      map[date].services.push(svc);
      map[date].totalCount++;
      if (svc.service_type === 'amc_service') map[date].amcCount++;
      else if (svc.service_type === 'paid_service') map[date].paidCount++;
      else if (svc.service_type === 'installation') map[date].installationCount++;
    }
    return map;
  }, [services]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    // Pad to complete the last week
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth, currentYear]);

  const getDateStr = (day: number) => {
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${currentYear}-${m}-${d}`;
  };

  const todayStr = today.toISOString().split('T')[0];
  const selectedServices = selectedDate && dayMap[selectedDate] ? dayMap[selectedDate].services : [];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };
  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDate(todayStr);
  };

  // Summary for month
  const monthTotals = useMemo(() => {
    let amc = 0, paid = 0, installation = 0, completed = 0;
    for (const svc of services) {
      if (svc.service_type === 'amc_service') amc++;
      else if (svc.service_type === 'paid_service') paid++;
      else if (svc.service_type === 'installation') installation++;
      if (svc.status === 'completed') completed++;
    }
    return { amc, paid, installation, completed, total: services.length };
  }, [services]);

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Service Calendar</h1>
          <p className="text-muted-foreground">View scheduled services and AMC by date</p>
        </div>
        <Button variant="outline" onClick={goToday}>
          <CalendarDays className="mr-2 h-4 w-4" /> Today
        </Button>
      </div>

      {/* Month summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{monthTotals.total}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">AMC</p><p className="text-xl font-bold text-blue-600">{monthTotals.amc}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-bold text-orange-600">{monthTotals.paid}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Installation</p><p className="text-xl font-bold text-purple-600">{monthTotals.installation}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-bold text-green-600">{monthTotals.completed}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
              <CardTitle className="text-lg">{MONTH_NAMES[currentMonth]} {currentYear}</CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loading />
            ) : (
              <div>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-px bg-muted/30 rounded-lg overflow-hidden">
                  {calendarDays.map((day, idx) => {
                    if (day === null) {
                      return <div key={`e-${idx}`} className="bg-background min-h-[80px]" />;
                    }
                    const dateStr = getDateStr(day);
                    const dayData = dayMap[dateStr];
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDate(dateStr)}
                        className={cn(
                          'bg-background min-h-[80px] p-1.5 text-left transition-colors hover:bg-accent/50 relative',
                          isSelected && 'ring-2 ring-primary ring-inset',
                          isToday && 'bg-blue-50/50'
                        )}
                      >
                        <span className={cn(
                          'text-xs font-medium',
                          isToday && 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                        )}>
                          {day}
                        </span>
                        {dayData && dayData.totalCount > 0 && (
                          <div className="mt-1">
                            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-1">
                              <Wrench className="h-3 w-3" />
                              <span>{dayData.totalCount}</span>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side panel — selected day's services */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {selectedDate ? formatDate(selectedDate) : 'Select a date'}
              </CardTitle>
              {selectedServices.length > 0 && (
                <p className="text-sm text-muted-foreground">{selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''}</p>
              )}
            </CardHeader>
            <CardContent>
              {selectedServices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No services on this date</p>
              ) : (
                <div className="space-y-3">
                  {selectedServices.map((svc: any) => {
                    const customer = svc.customer;
                    return (
                      <Link
                        key={svc.id}
                        href={`/dashboard/services/${svc.id}`}
                        className="block rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 min-w-0">
                            <p className="text-sm font-medium truncate">{customer?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{customer?.customer_code} {customer?.city ? `· ${customer.city}` : ''}</p>
                          </div>
                          <Badge className={cn('shrink-0 ml-2 text-[10px]', getStatusColor(svc.status))}>
                            {SERVICE_STATUS_LABELS[svc.status as keyof typeof SERVICE_STATUS_LABELS] || svc.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px]">
                            {SERVICE_TYPE_LABELS[svc.service_type as keyof typeof SERVICE_TYPE_LABELS] || svc.service_type}
                          </Badge>
                          {svc.scheduled_time_slot && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" /> {svc.scheduled_time_slot}
                            </span>
                          )}
                          {svc.total_amount > 0 && (
                            <span className="text-[10px] font-medium ml-auto">{formatCurrency(svc.total_amount)}</span>
                          )}
                        </div>
                        {svc.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{svc.description}</p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
