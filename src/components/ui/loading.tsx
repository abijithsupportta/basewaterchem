'use client';

import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className={`h-8 w-8 animate-spin text-primary ${className || ''}`} />
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { getStatusColor } = require('@/lib/utils');
  const colorClass = getStatusColor(status);
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass} ${className || ''}`}>
      {label}
    </span>
  );
}

// Alias for convenience
export const Loading = PageLoading;
