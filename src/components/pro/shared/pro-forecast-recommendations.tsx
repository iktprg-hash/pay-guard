"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Lightbulb } from "lucide-react";
import type {
  ForecastMonth,
  ForecastRecommendation,
} from "@/lib/pro/cash-flow-forecast";
import { formatForecastMonth } from "@/lib/pro/format-forecast-month";
import { cn, formatMoney } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

interface ProForecastRecommendationsProps {
  recommendations: ForecastRecommendation[];
  months: ForecastMonth[];
  locale: Locale;
  /** Limit items shown (dashboard uses 2, forecast page shows all) */
  limit?: number;
  compact?: boolean;
}

/** Actionable forecast takeaways — deficit, critical debts, etc. */
export function ProForecastRecommendations({
  recommendations,
  months,
  locale,
  limit,
  compact = false,
}: ProForecastRecommendationsProps) {
  const t = useTranslations("pro.forecast");
  const items = limit ? recommendations.slice(0, limit) : recommendations;

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("noRecommendations")}</p>
    );
  }

  return (
    <ul className={cn("space-y-2", compact ? "space-y-1.5" : "space-y-3")}>
      {items.map((rec, i) => {
        const isDanger =
          rec.kind === "projected_deficit" || rec.kind === "critical_debts";

        let text: string;
        switch (rec.kind) {
          case "monthly_deficit":
            text = t("recMonthlyDeficit", {
              amount: formatMoney(rec.amount ?? 0, locale),
            });
            break;
          case "projected_deficit": {
            const month = months[rec.monthIndex ?? 0];
            text = t("recProjectedDeficit", {
              month: month
                ? formatForecastMonth(month.yearMonth, locale)
                : "",
              amount: formatMoney(rec.amount ?? 0, locale),
            });
            break;
          }
          case "critical_debts":
            text = t("recCriticalDebts", { count: rec.count ?? 0 });
            break;
          case "urgent_debts":
            text = t("recUrgentDebts", { count: rec.count ?? 0 });
            break;
          default:
            text = "";
        }

        return (
          <li
            key={`${rec.kind}-${i}`}
            className={cn(
              "flex gap-3 rounded-lg border text-sm",
              compact ? "px-2.5 py-2" : "p-3",
              isDanger
                ? "border-destructive/30 bg-destructive/5"
                : "border-amber-500/30 bg-amber-500/5"
            )}
          >
            {isDanger ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            ) : (
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}
