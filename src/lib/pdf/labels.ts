import type { DebtCategory } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

export interface PdfLabels {
  title: string;
  generatedAt: string;
  userSection: string;
  availableFunds: string;
  spendableFunds: string;
  summary: string;
  buffer: string;
  creditor: string;
  amount: string;
  level: string;
  reason: string;
  index: string;
  remaining: string;
  warnings: string;
  footer: string;
  paymentsSection: string;
  levels: Record<number, string>;
  categories: Record<DebtCategory, string>;
}

const CATEGORY_LABELS: Record<
  Locale,
  Record<DebtCategory, string>
> = {
  cs: {
    housing: "Bydlení",
    utilities: "Energie a služby",
    taxes: "Daně",
    fines: "Pokuty",
    loans: "Půjčky",
    credit_card: "Kreditní karta",
    medical: "Zdravotní",
    transport: "Doprava",
    food: "Jídlo",
    subscriptions: "Předplatné",
    other: "Ostatní",
  },
  ru: {
    housing: "Жильё",
    utilities: "Коммунальные",
    taxes: "Налоги",
    fines: "Штрафы",
    loans: "Кредиты",
    credit_card: "Кредитная карта",
    medical: "Медицина",
    transport: "Транспорт",
    food: "Еда",
    subscriptions: "Подписки",
    other: "Прочее",
  },
  en: {
    housing: "Housing",
    utilities: "Utilities",
    taxes: "Taxes",
    fines: "Fines",
    loans: "Loans",
    credit_card: "Credit card",
    medical: "Medical",
    transport: "Transport",
    food: "Food",
    subscriptions: "Subscriptions",
    other: "Other",
  },
};

const LABELS: Record<Locale, Omit<PdfLabels, "categories">> = {
  cs: {
    title: "Pay Guard — Doporučení plateb",
    generatedAt: "Vygenerováno",
    userSection: "Přehled financí",
    availableFunds: "Volné prostředky",
    spendableFunds: "K dispozici k rozdělení",
    summary: "Shrnutí",
    buffer: "Rezerva na život",
    creditor: "Věřitel",
    amount: "Částka",
    level: "Priorita",
    reason: "Důvod",
    index: "№",
    remaining: "Zbývá",
    warnings: "Upozornění",
    footer:
      "Pay Guard nenahrazuje finančního poradce. Orientační doporučení.",
    paymentsSection: "Doporučené platby",
    levels: { 0: "Kritický", 1: "Vysoký", 2: "Střední", 3: "Nízký" },
  },
  ru: {
    title: "Pay Guard — Рекомендации по платежам",
    generatedAt: "Сформировано",
    userSection: "Финансовый обзор",
    availableFunds: "Свободные средства",
    spendableFunds: "Доступно к распределению",
    summary: "Итог",
    buffer: "Резерв на жизнь",
    creditor: "Кредитор",
    amount: "Сумма",
    level: "Приоритет",
    reason: "Причина",
    index: "№",
    remaining: "Остаток",
    warnings: "Предупреждения",
    footer:
      "Pay Guard не заменяет финансового или юридического консультанта. Рекомендации носят ориентировочный характер.",
    paymentsSection: "Рекомендуемые платежи",
    levels: { 0: "Критический", 1: "Высокий", 2: "Средний", 3: "Низкий" },
  },
  en: {
    title: "Pay Guard — Payment Recommendations",
    generatedAt: "Generated",
    userSection: "Financial overview",
    availableFunds: "Available funds",
    spendableFunds: "Spendable for allocation",
    summary: "Summary",
    buffer: "Life buffer",
    creditor: "Creditor",
    amount: "Amount",
    level: "Priority",
    reason: "Reason",
    index: "#",
    remaining: "Remaining",
    warnings: "Warnings",
    footer: "Pay Guard does not replace a financial advisor.",
    paymentsSection: "Recommended payments",
    levels: { 0: "Critical", 1: "High", 2: "Medium", 3: "Low" },
  },
};

export function getPdfLabels(locale: Locale): PdfLabels {
  return {
    ...LABELS[locale],
    categories: CATEGORY_LABELS[locale],
  };
}
