export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-md bg-muted" />
          <div className="h-4 w-80 rounded-md bg-muted" />
        </div>
        <div className="h-10 w-36 rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-card p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-8 w-20 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-10 w-full rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
