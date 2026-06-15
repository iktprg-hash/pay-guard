/**
 * Pro section navigation config.
 * Used by desktop sidebar and mobile bottom nav in {@link ProShell}.
 */

import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

/** Single Pro nav link definition. */
export interface ProNavItem {
  /** Builds locale-aware href, e.g. `/cs/pro/debts`. */
  href: (locale: string) => string;
  /** Key under `pro.nav.*` in messages. */
  labelKey: ProNavLabelKey;
  icon: LucideIcon;
}

export type ProNavLabelKey =
  | "dashboard"
  | "debts"
  | "incomes"
  | "expenses"
  | "forecast";

/** Ordered navigation items for Pay Guard Pro. */
export const PRO_NAV_ITEMS: ProNavItem[] = [
  {
    href: (locale) => `/${locale}/pro/dashboard`,
    labelKey: "dashboard",
    icon: LayoutDashboard,
  },
  {
    href: (locale) => `/${locale}/pro/debts`,
    labelKey: "debts",
    icon: Wallet,
  },
  {
    href: (locale) => `/${locale}/pro/incomes`,
    labelKey: "incomes",
    icon: TrendingUp,
  },
  {
    href: (locale) => `/${locale}/pro/expenses`,
    labelKey: "expenses",
    icon: TrendingDown,
  },
  {
    href: (locale) => `/${locale}/pro/forecast`,
    labelKey: "forecast",
    icon: CalendarRange,
  },
];

/** Resolve whether a pathname matches a nav item (exact or nested). */
export function isProNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
