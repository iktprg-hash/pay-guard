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

interface SkeletonProps {
  label?: string;
  className?: string;
}

/** ProFeatureGate / route transition loading placeholder. */
export function ProGateSkeleton({ label, className }: SkeletonProps) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label ?? "Loading Pro workspace"}
    >
      <div className="space-y-2">
        <div className="h-8 w-52 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <ListTableSkeleton rows={4} />
    </div>
  );
}

/** Full dashboard / forecast loading skeleton. */
export function DashboardSkeleton({ label, className }: SkeletonProps) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label ?? "Loading dashboard"}
    >
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
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

/** List resource pages (debts, incomes, expenses). */
export function ProListPageSkeleton({ label, className }: SkeletonProps) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label ?? "Loading list"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <ListTableSkeleton rows={6} />
    </div>
  );
}

/** Consultations grid loading skeleton. */
export function ConsultationsSkeleton({ label, className }: SkeletonProps) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label ?? "Loading consultations"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card p-5 shadow-sm"
            aria-hidden
          >
            <div className="mb-3 flex gap-2">
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="mb-2 h-5 w-full animate-pulse rounded bg-muted" />
            <div className="mb-4 h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Table list skeleton for Pro resource pages. */
export function ListTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="rounded-xl border bg-card p-6 shadow-sm"
      aria-hidden
    >
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
