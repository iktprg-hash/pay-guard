"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarRange,
  CreditCard,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

interface ProDashboardQuickActionsProps {
  debtCount: number;
  incomeTotal: number;
  expenseTotal: number;
  className?: string;
}

const actionStyles =
  "group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Quick navigation to core Pro data pages. */
export function ProDashboardQuickActions({
  debtCount,
  incomeTotal,
  expenseTotal,
  className,
}: ProDashboardQuickActionsProps) {
  const t = useTranslations("pro.dashboard");
  const locale = useLocale() as Locale;

  const actions = [
    {
      href: `/${locale}/pro/debts`,
      label: t("quickDebts"),
      hint: t("debtCount", { count: debtCount }),
      icon: CreditCard,
      iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      href: `/${locale}/pro/incomes`,
      label: t("quickIncomes"),
      hint: `+${formatMoney(incomeTotal, locale)}`,
      icon: ArrowUpCircle,
      iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      href: `/${locale}/pro/expenses`,
      label: t("quickExpenses"),
      hint: `−${formatMoney(expenseTotal, locale)}`,
      icon: ArrowDownCircle,
      iconClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
    {
      href: `/${locale}/pro/forecast`,
      label: t("quickForecast"),
      hint: t("quickForecastHint"),
      icon: CalendarRange,
      iconClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
  ] as const;

  return (
    <section aria-labelledby="pro-quick-actions-heading" className={className}>
      <h2
        id="pro-quick-actions-heading"
        className="mb-3 text-sm font-semibold tracking-tight text-foreground"
      >
        {t("quickActionsTitle")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map(({ href, label, hint, icon: Icon, iconClass }) => (
          <Link key={href} href={href} className={actionStyles}>
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  iconClass
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-xs text-muted-foreground group-hover:text-foreground">
                →
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs tabular-nums text-muted-foreground">{hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
