'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
  from?: string;
  to?: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}

export function DateRangePicker({ from, to, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected: DateRange | undefined = React.useMemo(() => {
    if (!from && !to) return undefined;
    return {
      from: from ? new Date(from + 'T00:00:00') : undefined,
      to: to ? new Date(to + 'T00:00:00') : undefined,
    };
  }, [from, to]);

  const handleSelect = (range: DateRange | undefined) => {
    const newFrom = range?.from ? format(range.from, 'yyyy-MM-dd') : '';
    const newTo = range?.to ? format(range.to, 'yyyy-MM-dd') : '';
    onChange(newFrom, newTo);
  };

  const label = React.useMemo(() => {
    if (from && to) return `${format(new Date(from + 'T00:00:00'), 'MMM d, yyyy')} – ${format(new Date(to + 'T00:00:00'), 'MMM d, yyyy')}`;
    if (from) return `${format(new Date(from + 'T00:00:00'), 'MMM d, yyyy')} – ...`;
    return 'Pick date range';
  }, [from, to]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-8 justify-start text-left text-xs font-normal',
            !from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarDays className="mr-2 h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={from ? new Date(from + 'T00:00:00') : new Date()}
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
