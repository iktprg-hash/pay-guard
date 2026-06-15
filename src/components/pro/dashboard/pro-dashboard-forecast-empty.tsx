"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarRange, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";

/** Shown when forecast cannot be built yet (missing recurring data). */
export function ProDashboardForecastEmpty() {
  const t = useTranslations("pro.dashboard");
  const locale = useLocale() as Locale;

  return (
    <Card className="flex h-full flex-col border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t("forecastSummaryTitle")}
        </CardTitle>
        <CardDescription>{t("forecastEmptyDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 pb-10 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">{t("forecastEmptyHint")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/pro/incomes`}>
              <TrendingUp className="mr-2 h-4 w-4" />
              {t("quickIncomes")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/pro/expenses`}>
              <TrendingDown className="mr-2 h-4 w-4" />
              {t("quickExpenses")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
