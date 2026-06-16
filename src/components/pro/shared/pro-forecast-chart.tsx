"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { formatForecastMonth } from "@/lib/pro/format-forecast-month";
import { cn, formatMoney } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

export interface ForecastChartMonth {
  yearMonth: string;
  endingBalance: number;
}

interface ProForecastChartProps {
  months: ForecastChartMonth[];
  chartScaleMax: number;
  locale: Locale;
  /** Shorter bars for compact dashboard embed */
  compact?: boolean;
  legend?: string;
  ariaLabel?: string;
}

/** Bar chart for projected ending balances (shared by Dashboard and Forecast). */
export const ProForecastChart = memo(function ProForecastChart({
  months,
  chartScaleMax,
  locale,
  compact = false,
  legend,
  ariaLabel,
}: ProForecastChartProps) {
  const t = useTranslations("pro.forecast");

  const hasDeficit = months.some((m) => m.endingBalance < 0);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-end justify-around gap-2 rounded-xl border border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 px-3 pb-3 pt-4 shadow-sm",
          compact ? "h-36" : "h-48 px-4 pb-4 pt-6"
        )}
        role="img"
        aria-label={ariaLabel ?? t("chartTitle")}
      >
        {months.map((month) => {
          const heightPct = Math.max(
            8,
            (Math.abs(month.endingBalance) / chartScaleMax) * 100
          );
          const positive = month.endingBalance >= 0;

          return (
            <div
              key={month.yearMonth}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  positive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                )}
              >
                {formatMoney(month.endingBalance, locale)}
              </span>
              <div
                className={cn(
                  "flex w-full items-end justify-center",
                  compact ? "h-20" : "h-32"
                )}
              >
                <div
                  className={cn(
                    "w-full rounded-t-md shadow-sm transition-all duration-200",
                    "group-hover:scale-[1.02] group-hover:shadow-md",
                    compact ? "max-w-12" : "max-w-16",
                    positive ? "bg-emerald-500/80" : "bg-destructive/80"
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="truncate text-center text-[10px] text-muted-foreground sm:text-xs">
                {formatForecastMonth(month.yearMonth, locale)}
              </span>
            </div>
          );
        })}
      </div>
      {legend && (
        <p className="text-xs text-muted-foreground">
          {legend}
          {hasDeficit ? ` ${t("chartDeficitHint")}` : ""}
        </p>
      )}
    </div>
  );
});
