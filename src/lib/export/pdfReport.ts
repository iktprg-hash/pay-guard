/**
 * Export doporučení Priority Engine do PDF.
 * Generuje se čistě na klientovi — žádná data neopouští prohlížeč.
 */

import type { jsPDF } from "jspdf";
import { resolvePriorityLevel } from "@/lib/financial/priorityLevel";
import {
  formatMoney as formatLocaleMoney,
  getIntlLocale,
} from "@/lib/financial/locale-config";
import type { PrioritizationResult } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

type ReportLocale = Locale;

const LABELS: Record<
  ReportLocale,
  {
    title: string;
    summary: string;
    buffer: string;
    creditor: string;
    amount: string;
    level: string;
    reason: string;
    remaining: string;
    warnings: string;
    footer: string;
    paymentsSection: string;
    levels: Record<number, string>;
  }
> = {
  cs: {
    title: "Pay Guard — Doporučení plateb",
    summary: "Shrnutí",
    buffer: "Rezerva na život",
    creditor: "Věřitel",
    amount: "Částka",
    level: "Priorita",
    reason: "Vysvětlení",
    remaining: "Zbývá",
    warnings: "Upozornění",
    footer: "Pay Guard nenahrazuje finančního poradce. Orientační doporučení.",
    paymentsSection: "Doporučené platby",
    levels: { 0: "Kritický", 1: "Vysoký", 2: "Střední", 3: "Nízký" },
  },
  ru: {
    title: "Pay Guard — Рекомендации по платежам",
    summary: "Итог",
    buffer: "Резерв на жизнь",
    creditor: "Кредитор",
    amount: "Сумма",
    level: "Приоритет",
    reason: "Объяснение",
    remaining: "Остаток",
    warnings: "Предупреждения",
    footer: "Pay Guard не заменяет финансового или юридического консультанта. Рекомендации носят ориентировочный характер.",
    paymentsSection: "Рекомендуемые платежи",
    levels: { 0: "Критический", 1: "Высокий", 2: "Средний", 3: "Низкий" },
  },
  en: {
    title: "Pay Guard — Payment Recommendations",
    summary: "Summary",
    buffer: "Life buffer",
    creditor: "Creditor",
    amount: "Amount",
    level: "Priority",
    reason: "Explanation",
    remaining: "Remaining",
    warnings: "Warnings",
    footer: "Pay Guard does not replace a financial advisor.",
    paymentsSection: "Recommended payments",
    levels: { 0: "Critical", 1: "High", 2: "Medium", 3: "Low" },
  },
};

function formatMoney(amount: number, locale: ReportLocale): string {
  return formatLocaleMoney(amount, locale);
}

/** Zalomí dlouhý text na řádky */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/**
 * Vygeneruje a stáhne PDF report.
 */
export async function downloadPriorityReport(
  result: PrioritizationResult,
  locale: ReportLocale = "cs"
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const L = LABELS[locale];
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // Hlavička
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(L.title, margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(new Date().toLocaleDateString(getIntlLocale(locale)), margin, y);
  doc.setTextColor(0);
  y += 10;

  // Shrnutí
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(L.summary, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const line of wrapText(doc, result.summary, contentWidth)) {
    addPageIfNeeded(6);
    doc.text(line, margin, y);
    y += 5;
  }

  if (result.lifeBuffer > 0) {
    y += 2;
    doc.text(
      `${L.buffer}: ${formatMoney(result.lifeBuffer, locale)} (${Math.round(result.lifeBufferPercent * 100)} %)`,
      margin,
      y
    );
    y += 8;
  }

  // Tabulka doporučení
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  addPageIfNeeded(10);
  doc.text(L.paymentsSection, margin, y);
  y += 8;

  result.recommendations.forEach((rec, i) => {
    addPageIfNeeded(30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      `${i + 1}. ${rec.creditor} — ${formatMoney(rec.recommendedAmount, locale)}`,
      margin,
      y
    );
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(
      `${L.level}: ${L.levels[resolvePriorityLevel(rec)]} (${resolvePriorityLevel(rec)})`,
      margin,
      y
    );
    y += 5;

    doc.setTextColor(0);
    const explanation = rec.explanation || rec.reason;
    for (const line of wrapText(doc, explanation, contentWidth)) {
      addPageIfNeeded(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 4;
  });

  // Zbývá
  addPageIfNeeded(10);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${L.remaining}: ${formatMoney(result.remainingFunds, locale)}`,
    margin,
    y
  );
  y += 10;

  // Varování
  if (result.warnings.length > 0) {
    addPageIfNeeded(15);
    doc.setTextColor(180, 100, 0);
    doc.text(L.warnings, margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const w of result.warnings) {
      for (const line of wrapText(doc, `• ${w}`, contentWidth)) {
        addPageIfNeeded(5);
        doc.text(line, margin, y);
        y += 4.5;
      }
    }
    doc.setTextColor(0);
  }

  // Patička
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(L.footer, margin, 290);
    doc.text(`${p}/${pageCount}`, pageWidth - margin - 10, 290);
  }

  const date = new Date().toISOString().split("T")[0];
  doc.save(`pay-guard-${date}.pdf`);
}
