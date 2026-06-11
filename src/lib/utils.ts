import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Sloučí Tailwind třídy bez konfliktů */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formátuje částku v CZK */
export function formatCZK(amount: number, locale = "cs-CZ"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formátuje datum podle locale */
export function formatDate(
  date: string | Date,
  locale = "cs-CZ"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(d);
}
