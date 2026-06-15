"use client";

import { cn } from "@/lib/utils";
import { AlertOctagon, CheckCircle2, TrendingDown } from "lucide-react";

interface ProDashboardHealthBannerProps {
  criticalCount: number;
  netMonthlyCashFlow: number;
  labels: {
    critical: string;
    deficit: string;
    healthy: string;
  };
}

/** At-a-glance financial health strip for the Pro dashboard. */
export function ProDashboardHealthBanner({
  criticalCount,
  netMonthlyCashFlow,
  labels,
}: ProDashboardHealthBannerProps) {
  const variant =
    criticalCount > 0
      ? "critical"
      : netMonthlyCashFlow < 0
        ? "deficit"
        : "healthy";

  const config = {
    critical: {
      icon: AlertOctagon,
      message: labels.critical,
      className:
        "border-destructive/30 bg-destructive/5 text-destructive dark:text-red-300",
    },
    deficit: {
      icon: TrendingDown,
      message: labels.deficit,
      className:
        "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100",
    },
    healthy: {
      icon: CheckCircle2,
      message: labels.healthy,
      className:
        "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100",
    },
  }[variant];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium",
        config.className
      )}
      role="status"
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span>{config.message}</span>
    </div>
  );
}
