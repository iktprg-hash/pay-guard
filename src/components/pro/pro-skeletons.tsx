import { cn } from "@/lib/utils";

/** Pulse skeleton for Pro dashboard stat cards. */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card p-5 shadow-sm",
        className
      )}
      aria-hidden
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="h-3 w-24 animate-pulse rounded-md bg-muted/80" />
        <div className="h-8 w-8 animate-pulse rounded-lg bg-muted/60" />
      </div>
      <div className="mb-2 h-8 w-32 animate-pulse rounded-md bg-muted" />
      <div className="h-3 w-20 animate-pulse rounded-md bg-muted/70" />
    </div>
  );
}

interface SkeletonProps {
  label?: string;
  className?: string;
}

export type ProPageSkeletonVariant =
  | "gate"
  | "dashboard"
  | "forecast"
  | "list";

/** Unified entry point for Pro page loading states. */
export function ProPageSkeleton({
  variant = "dashboard",
  label,
  className,
}: SkeletonProps & { variant?: ProPageSkeletonVariant }) {
  switch (variant) {
    case "gate":
      return <ProGateSkeleton label={label} className={className} />;
    case "list":
      return <ProListPageSkeleton label={label} className={className} />;
    case "forecast":
      return <ForecastSkeleton label={label} className={className} />;
    case "dashboard":
    default:
      return <DashboardSkeleton label={label} className={className} />;
  }
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
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <ListTableSkeleton rows={4} />
    </div>
  );
}

/** Full dashboard loading skeleton. */
export function DashboardSkeleton({ label, className }: SkeletonProps) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label ?? "Loading dashboard"}
    >
      <PageHeaderSkeleton wide />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ListTableSkeleton rows={5} />
        <CardBlockSkeleton lines={4} />
      </div>
    </div>
  );
}

/** Forecast page — three metric cards + breakdown card. */
export function ForecastSkeleton({ label, className }: SkeletonProps) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label ?? "Loading forecast"}
    >
      <PageHeaderSkeleton wide />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <CardBlockSkeleton lines={5} titleWidth="w-48" />
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
        <PageHeaderSkeleton />
        <div className="h-9 w-32 shrink-0 animate-pulse rounded-md bg-muted" />
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
        <PageHeaderSkeleton wide />
        <div className="h-9 w-40 shrink-0 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-card p-5 shadow-sm"
            aria-hidden
          >
            <div className="mb-3 flex gap-2">
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="mb-2 h-5 w-full animate-pulse rounded-md bg-muted" />
            <div className="mb-4 h-4 w-2/3 animate-pulse rounded-md bg-muted/80" />
            <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PageHeaderSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="space-y-2" aria-hidden>
      <div
        className={cn(
          "h-8 animate-pulse rounded-lg bg-muted",
          wide ? "w-52" : "w-44"
        )}
      />
      <div
        className={cn(
          "h-4 max-w-full animate-pulse rounded-md bg-muted/80",
          wide ? "w-80" : "w-64"
        )}
      />
    </div>
  );
}

function CardBlockSkeleton({
  lines = 4,
  titleWidth = "w-40",
}: {
  lines?: number;
  titleWidth?: string;
}) {
  return (
    <div
      className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
      aria-hidden
    >
      <div className={cn("mb-4 h-5 animate-pulse rounded-md bg-muted", titleWidth)} />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded-md bg-muted/80" />
        ))}
      </div>
    </div>
  );
}

/** Table list skeleton for Pro resource pages. */
export function ListTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
      aria-hidden
    >
      <div className="mb-4 h-5 w-40 animate-pulse rounded-md bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3"
          >
            <div className="h-10 flex-1 animate-pulse rounded-md bg-muted/80" />
            <div className="hidden h-8 w-16 animate-pulse rounded-md bg-muted/60 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
