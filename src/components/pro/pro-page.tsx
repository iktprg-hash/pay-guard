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
  /** Optional numbered setup steps (Pro onboarding). */
  steps?: string[];
}

/** Empty state placeholder for Pro list pages. */
export function ProEmptyState({
  icon,
  title,
  description,
  action,
  steps,
}: ProEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <h3 className="mb-1 text-base font-semibold">{title}</h3>
        <p className="mb-4 max-w-md text-sm text-muted-foreground">{description}</p>
        {steps && steps.length > 0 && (
          <ol className="mb-6 w-full max-w-sm space-y-2 text-left text-sm">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        )}
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
  /** Top accent stripe — used on Pro dashboard metric cards. */
  accent?: "emerald" | "blue" | "amber" | "destructive" | "violet" | "neutral";
}

const ACCENT_STRIPE: Record<NonNullable<StatCardProps["accent"]>, string> = {
  emerald: "border-t-emerald-500",
  blue: "border-t-blue-500",
  amber: "border-t-amber-500",
  destructive: "border-t-destructive",
  violet: "border-t-violet-500",
  neutral: "border-t-border",
};

const ACCENT_BG: Record<NonNullable<StatCardProps["accent"]>, string> = {
  emerald: "bg-gradient-to-br from-emerald-500/5 via-card to-card",
  blue: "bg-gradient-to-br from-blue-500/5 via-card to-card",
  amber: "bg-gradient-to-br from-amber-500/5 via-card to-card",
  destructive: "bg-gradient-to-br from-destructive/5 via-card to-card",
  violet: "bg-gradient-to-br from-violet-500/5 via-card to-card",
  neutral: "bg-card",
};

interface ProSectionHeadingProps {
  id?: string;
  title: string;
  description?: string;
  className?: string;
}

/** Visible section title for Pro dashboard / forecast blocks. */
export function ProSectionHeading({
  id,
  title,
  description,
  className,
}: ProSectionHeadingProps) {
  return (
    <div className={cn("mb-4 space-y-0.5", className)}>
      <h2 id={id} className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** Metric card for Pro dashboard. */
export function StatCard({
  label,
  value,
  hint,
  trend = "neutral",
  icon: Icon,
  iconClassName,
  accent = "neutral",
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-t-2 transition-shadow hover:shadow-md",
        ACCENT_STRIPE[accent],
        ACCENT_BG[accent]
      )}
    >
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
