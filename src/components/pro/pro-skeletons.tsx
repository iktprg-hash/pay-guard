import { cn } from "@/lib/utils";

/** Pulse skeleton for Pro dashboard stat cards. */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 shadow-sm",
        className
      )}
      aria-hidden
    >
      <div className="mb-3 h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mb-2 h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
    </div>
  );
}

/** Full dashboard loading skeleton. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <ListTableSkeleton />
    </div>
  );
}

/** Table list skeleton for Pro resource pages. */
export function ListTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm" aria-hidden>
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
