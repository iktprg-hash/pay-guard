"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatForecastMonth } from "@/lib/pro/format-forecast-month";
import type { ForecastMonth } from "@/lib/pro/cash-flow-forecast";
import { cn, formatMoney } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

interface ProForecastInsightBannerProps {
  months: ForecastMonth[];
  locale: Locale;
  /** Use pro.forecast keys when on the Forecast page */
  namespace?: "pro.dashboard" | "pro.forecast";
}

/** Single-line forecast takeaway — deficit warning or healthy summary. */
export function ProForecastInsightBanner({
  months,
  locale,
  namespace = "pro.dashboard",
}: ProForecastInsightBannerProps) {
  const t = useTranslations(namespace);

  if (months.length === 0) return null;

  const lastMonth = months[months.length - 1]!;
  const hasDeficit = months.some((m) => m.endingBalance < 0);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        hasDeficit
          ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100"
      )}
      role="status"
    >
      {hasDeficit ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      )}
      <span>
        {hasDeficit
          ? t("forecastDeficitWarning", {
              month: formatForecastMonth(lastMonth.yearMonth, locale),
            })
          : t("forecastHealthySummary", {
              amount: formatMoney(lastMonth.endingBalance, locale),
              month: formatForecastMonth(lastMonth.yearMonth, locale),
            })}
      </span>
    </div>
  );
}
