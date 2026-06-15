import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProPageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Consistent page header for Pro routes. */
export function ProPageHeader({
  title,
  description,
  action,
  className,
}: ProPageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface ProEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

/** Empty state placeholder for Pro list pages. */
export function ProEmptyState({
  icon,
  title,
  description,
  action,
}: ProEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <h3 className="mb-1 text-base font-semibold">{title}</h3>
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
        {action}
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  iconClassName?: string;
}

/** Metric card for Pro dashboard. */
export function StatCard({
  label,
  value,
  hint,
  trend = "neutral",
  icon: Icon,
  iconClassName,
}: StatCardProps) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          {Icon && (
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted",
                iconClassName
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>
        <CardTitle
          className={cn(
            "text-2xl font-bold tabular-nums tracking-tight",
            trend === "positive" && "text-emerald-600 dark:text-emerald-400",
            trend === "negative" && "text-destructive"
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      )}
    </Card>
  );
}
