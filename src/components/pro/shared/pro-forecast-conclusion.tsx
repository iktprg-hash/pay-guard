"use client";

import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { buildForecastConclusion } from "@/lib/pro/forecast-conclusion";
import { formatForecastMonth } from "@/lib/pro/format-forecast-month";
import type { ForecastMonth } from "@/lib/pro/cash-flow-forecast";
import { cn, formatMoney } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProForecastConclusionProps {
  months: ForecastMonth[];
  netMonthlyChange: number;
  locale: Locale;
  namespace?: "pro.dashboard" | "pro.forecast";
  compact?: boolean;
  className?: string;
}

/** Narrative forecast summary — deficit warning or stable outlook in plain language. */
export function ProForecastConclusion({
  months,
  netMonthlyChange,
  locale,
  namespace = "pro.forecast",
  compact = false,
  className,
}: ProForecastConclusionProps) {
  const t = useTranslations(namespace);
  const conclusion = buildForecastConclusion(months, netMonthlyChange);

  if (!conclusion) return null;

  const month =
    conclusion.monthIndex != null
      ? months[conclusion.monthIndex]
      : months[months.length - 1];

  let text: string;
  switch (conclusion.kind) {
    case "projected_deficit":
      text = t("conclusionProjectedDeficit", {
        amount: formatMoney(conclusion.amount, locale),
        month: month
          ? formatForecastMonth(month.yearMonth, locale)
          : "",
      });
      break;
    case "monthly_deficit":
      text = t("conclusionMonthlyDeficit", {
        amount: formatMoney(conclusion.amount, locale),
      });
      break;
    case "stable_positive":
      text = t("conclusionStable", {
        amount: formatMoney(conclusion.amount, locale),
        month: month
          ? formatForecastMonth(month.yearMonth, locale)
          : "",
      });
      break;
  }

  const tone =
    conclusion.kind === "stable_positive"
      ? "border-emerald-500/25 bg-emerald-500/5"
      : "border-amber-500/25 bg-amber-500/5";

  if (compact) {
    return (
      <p
        className={cn(
          "rounded-lg border px-3 py-2 text-sm leading-relaxed",
          tone,
          className
        )}
      >
        {text}
      </p>
    );
  }

  return (
    <Card className={cn("border-primary/15", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" aria-hidden />
          {t("conclusionTitle")}
        </CardTitle>
        <CardDescription>{t("conclusionDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={cn("rounded-xl border px-4 py-3 text-sm leading-relaxed", tone)}>
          {text}
        </p>
      </CardContent>
    </Card>
  );
}
