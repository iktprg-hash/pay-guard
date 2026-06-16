"use client";

import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatForecastMonth } from "@/lib/pro/format-forecast-month";
import type { ForecastMonth } from "@/lib/pro/cash-flow-forecast";
import { cn, formatMoney } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

interface ProForecastMonthCardsProps {
  months: ForecastMonth[];
  locale: Locale;
  perMonthLabel?: string;
}

/** Compact month-by-month ending balance cards for Dashboard and Forecast. */
export function ProForecastMonthCards({
  months,
  locale,
  perMonthLabel,
}: ProForecastMonthCardsProps) {
  const t = useTranslations("pro.dashboard");
  const perMonth = perMonthLabel ?? t("perMonth");

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {months.map((month) => {
        const positive = month.endingBalance >= 0;
        return (
          <div
            key={month.yearMonth}
            className={cn(
              "rounded-lg border px-3 py-2.5 transition-shadow hover:shadow-sm",
              positive
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-destructive/20 bg-destructive/5"
            )}
          >
            <p className="text-xs text-muted-foreground">
              {formatForecastMonth(month.yearMonth, locale)}
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm font-bold tabular-nums",
                positive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              )}
            >
              {formatMoney(month.endingBalance, locale)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              {month.netChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              {formatMoney(month.netChange, locale)} {perMonth}
            </p>
          </div>
        );
      })}
    </div>
  );
}
