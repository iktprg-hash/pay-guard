/**
 * Pay Guard — Priority Engine
 * ===========================
 * Deterministický algoritmus prioritizace plateb (bez AI).
 *
 * Principy:
 * 1. Čtyři úrovně priority (0 = kritický … 3 = nízký)
 * 2. Povinný životní buffer 20–35 % z volných prostředků
 * 3. Kritické termíny (vystěhování, exekuce) mají přednost
 * 4. Proporcionální rozdělení peněz v rámci úrovně
 * 5. Srozumitelná vysvětlení každého rozhodnutí
 */

import {
  formatMoney,
  roundMoney,
} from "@/lib/financial/locale-config";
import type {
  Debt,
  DebtCategory,
  FinancialProfile,
  IncomeStability,
  PaymentRecommendation,
  PriorityLevel,
  PrioritizationResult,
} from "@/lib/types/financial";

export type Locale = "cs" | "ru" | "en";

// ─── Konstanty ───────────────────────────────────────────────────────────────

/** Váha kategorie pro výpočet naléhavosti */
const CATEGORY_WEIGHT: Record<DebtCategory, number> = {
  housing: 1.0,
  utilities: 0.9,
  taxes: 0.95,
  fines: 0.9,
  medical: 0.75,
  loans: 0.6,
  credit_card: 0.45,
  other: 0.35,
};

/** Základní váha úrovně pro proporcionální dělení */
const LEVEL_WEIGHT: Record<PriorityLevel, number> = {
  0: 100,
  1: 75,
  2: 50,
  3: 25,
};

/** Esenciální kategorie — vyšší riziko při prodlení */
const ESSENTIAL_CATEGORIES: DebtCategory[] = [
  "housing",
  "utilities",
  "taxes",
  "fines",
];

/** Klíčová slova: exekuce (CZ) / исполнительное производство, ФССП (RU) */
const EXECUTION_KEYWORDS =
  /exeku|výkon\s+rozsudku|soudní\s+exekutor|executor|enforcement|выселен|исполнител|фссп|судебн.*пристав|пристав|арест\s+сч|принудительн|взыскан/i;

// ─── Pomocné funkce ────────────────────────────────────────────────────────

/**
 * Detekuje riziko exekuce z poznámky nebo kategorie pokut.
 * Edge case: exekuce má vždy prioritu 0.
 */
export function isExecutionRisk(debt: Debt): boolean {
  const text = [debt.criticalNote, debt.notes, debt.creditor]
    .filter(Boolean)
    .join(" ");
  return EXECUTION_KEYWORDS.test(text);
}

/**
 * Vrátí nejbližší termín v dnech (min ze splatnosti a kritického data).
 * Edge case: více termínů u jednoho dluhu.
 */
export function nearestDeadlineDays(
  daysToDue: number | null,
  daysToCritical: number | null
): number | null {
  const candidates = [daysToDue, daysToCritical].filter(
    (d): d is number => d !== null
  );
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

/** Má dluh více nezávislých termínů? */
export function hasMultipleDeadlines(
  daysToDue: number | null,
  daysToCritical: number | null
): boolean {
  return daysToDue !== null && daysToCritical !== null;
}

/** Počet celých dní od `from` do `to` (kladné = budoucnost) */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** Bezpečný parse ISO data */
function parseDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Vypočítá procento životního bufferu podle stability příjmu.
 * stable → 20 %, variable → 28 %, uncertain → 35 %, neznámé → 25 %
 */
export function calculateLifeBufferPercent(
  stability?: IncomeStability
): number {
  switch (stability) {
    case "stable":
      return 0.2;
    case "variable":
      return 0.28;
    case "uncertain":
      return 0.35;
    default:
      return 0.25;
  }
}


// ─── Určení úrovně priority ────────────────────────────────────────────────

interface DebtAnalysis {
  debt: Debt;
  level: PriorityLevel;
  urgencyScore: number;
  daysToDue: number | null;
  daysToCritical: number | null;
  factors: string[];
}

/**
 * Přiřadí úroveň priority 0–3 a skóre naléhavosti jednomu dluhu.
 *
 * Úroveň 0 (Kritický): po splatnosti esenciálů, kritický termín ≤3 dny
 * Úroveň 1 (Vysoký):   splatnost ≤7 dní, kritický termín ≤14 dní, po splatnosti
 * Úroveň 2 (Střední):  splatnost ≤30 dní, esenciální bez data
 * Úroveň 3 (Nízký):    vše ostatní
 */
export function analyzeDebt(debt: Debt, today: Date = new Date()): DebtAnalysis {
  const due = parseDate(debt.dueDate);
  const critical = parseDate(debt.criticalDate);

  const daysToDue = due ? daysBetween(today, due) : null;
  const daysToCritical = critical ? daysBetween(today, critical) : null;

  const factors: string[] = [];
  let level: PriorityLevel = 3;

  const execution = isExecutionRisk(debt);
  const multipleDeadlines = hasMultipleDeadlines(daysToDue, daysToCritical);
  const nearest = nearestDeadlineDays(daysToDue, daysToCritical);

  if (multipleDeadlines) factors.push("multiple_deadlines");
  if (execution) factors.push("execution_risk");

  // ── Úroveň 0: Kritický ──
  const criticalImminent =
    daysToCritical !== null && daysToCritical <= 3;
  const criticalPassed = daysToCritical !== null && daysToCritical <= 0;
  const essentialOverdue =
    daysToDue !== null &&
    daysToDue < 0 &&
    ESSENTIAL_CATEGORIES.includes(debt.category);
  const nearestImminent = nearest !== null && nearest <= 3;
  const nearestPassed = nearest !== null && nearest <= 0;

  if (
    execution ||
    criticalPassed ||
    criticalImminent ||
    essentialOverdue ||
    nearestImminent ||
    nearestPassed
  ) {
    level = 0;
    if (execution) factors.push("execution");
    if (criticalPassed) factors.push("critical_passed");
    if (criticalImminent) factors.push("critical_imminent");
    if (essentialOverdue) factors.push("essential_overdue");
    if (nearestImminent && !criticalImminent) factors.push("nearest_imminent");
    if (nearestPassed && !criticalPassed) factors.push("nearest_passed");
  }
  // ── Úroveň 1: Vysoký ──
  else if (
    (daysToDue !== null && daysToDue <= 7) ||
    (daysToCritical !== null && daysToCritical <= 14) ||
    (daysToDue !== null && daysToDue < 0) ||
    (nearest !== null && nearest <= 7)
  ) {
    level = 1;
    if (daysToDue !== null && daysToDue <= 7) factors.push("due_soon");
    if (daysToCritical !== null && daysToCritical <= 14)
      factors.push("critical_soon");
    if (daysToDue !== null && daysToDue < 0) factors.push("overdue");
  }
  // ── Úroveň 2: Střední ──
  else if (
    (daysToDue !== null && daysToDue <= 30) ||
    (ESSENTIAL_CATEGORIES.includes(debt.category) && !due && !critical)
  ) {
    level = 2;
    if (daysToDue !== null && daysToDue <= 30) factors.push("due_month");
    if (ESSENTIAL_CATEGORIES.includes(debt.category))
      factors.push("essential");
  }
  // ── Úroveň 3: Nízký (default) ──
  else {
    level = 3;
    factors.push("low_urgency");
  }

  // Skóre naléhavosti pro řazení a proporcionální váhu
  let urgencyScore = LEVEL_WEIGHT[level] * CATEGORY_WEIGHT[debt.category];

  if (daysToCritical !== null) {
    if (daysToCritical <= 0) urgencyScore += 80;
    else if (daysToCritical <= 7) urgencyScore += 60;
    else if (daysToCritical <= 14) urgencyScore += 40;
  }

  if (daysToDue !== null) {
    if (daysToDue < 0) urgencyScore += 50;
    else if (daysToDue <= 3) urgencyScore += 40;
    else if (daysToDue <= 7) urgencyScore += 25;
    else if (daysToDue <= 14) urgencyScore += 15;
  }

  if (debt.interestRate && debt.interestRate > 15) urgencyScore += 10;

  // Edge: exekuce — maximální boost
  if (execution) urgencyScore += 100;

  // Edge: více termínů — boost podle nejbližšího
  if (multipleDeadlines && nearest !== null) {
    if (nearest <= 3) urgencyScore += 30;
    else if (nearest <= 7) urgencyScore += 15;
  }

  return { debt, level, urgencyScore, daysToDue, daysToCritical, factors };
}

// ─── Lokalizace ──────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<PriorityLevel, Record<Locale, string>> = {
  0: { cs: "Kritický", ru: "Критический", en: "Critical" },
  1: { cs: "Vysoký", ru: "Высокий", en: "High" },
  2: { cs: "Střední", ru: "Средний", en: "Medium" },
  3: { cs: "Nízký", ru: "Низкий", en: "Low" },
};

const CATEGORY_LABELS: Record<DebtCategory, Record<Locale, string>> = {
  housing: { cs: "bydlení", ru: "жильё / аренда", en: "housing" },
  utilities: { cs: "energie a služby", ru: "ЖКХ и коммуналка", en: "utilities" },
  taxes: { cs: "daně", ru: "налоги / ФНС", en: "taxes" },
  fines: { cs: "pokuty", ru: "штрафы / приставы", en: "fines" },
  loans: { cs: "půjčky", ru: "кредиты", en: "loans" },
  credit_card: { cs: "kreditní karta", ru: "кредитная карта", en: "credit card" },
  medical: { cs: "zdravotní", ru: "медицина", en: "medical" },
  other: { cs: "ostatní", ru: "прочее", en: "other" },
};

/** Sestaví lidsky čitelné vysvětlení rozhodnutí */
export function buildExplanation(
  analysis: DebtAnalysis,
  allocated: number,
  sharePercent: number,
  locale: Locale
): string {
  const { debt, level, daysToDue, daysToCritical, factors } = analysis;
  const parts: string[] = [];

  const levelLabel = LEVEL_LABELS[level][locale];
  const catLabel = CATEGORY_LABELS[debt.category][locale];

  if (locale === "cs") {
    parts.push(`Úroveň ${level} (${levelLabel}) — kategorie: ${catLabel}.`);

    if (debt.criticalNote && debt.criticalDate) {
      parts.push(`${debt.criticalNote} (termín ${debt.criticalDate}).`);
    } else if (daysToCritical !== null && daysToCritical <= 7) {
      parts.push(`Kritický termín za ${daysToCritical} dní.`);
    }

    if (daysToDue !== null && daysToDue < 0) {
      parts.push("Závazek je po splatnosti.");
    } else if (daysToDue !== null && daysToDue <= 7) {
      parts.push(`Splatnost za ${daysToDue} dní.`);
    }

    if (factors.includes("essential")) {
      parts.push("Esenciální výdaj — riziko vypnutí služeb nebo právních důsledků.");
    }
    if (factors.includes("execution") || factors.includes("execution_risk")) {
      parts.push("Riziko exekuce — nejvyšší právní priorita.");
    }
    if (factors.includes("multiple_deadlines")) {
      parts.push("Více termínů — rozhodujeme podle nejbližšího.");
    }

    parts.push(
      `Alokováno ${formatMoney(allocated, locale)} (${sharePercent.toFixed(0)} % disponibilní částky pro tuto úroveň).`
    );
  } else if (locale === "ru") {
    parts.push(`Уровень ${level} (${levelLabel}) — категория: ${catLabel}.`);

    if (debt.criticalNote && debt.criticalDate) {
      parts.push(`${debt.criticalNote} (срок ${debt.criticalDate}).`);
    } else if (daysToCritical !== null && daysToCritical <= 7) {
      parts.push(`Критический срок через ${daysToCritical} дн.`);
    }

    if (daysToDue !== null && daysToDue < 0) {
      parts.push("Обязательство просрочено.");
    } else if (daysToDue !== null && daysToDue <= 7) {
      parts.push(`Срок через ${daysToDue} дн.`);
    }

    if (factors.includes("essential")) {
      parts.push(
        "Обязательный расход — риск отключения услуг или юридических последствий."
      );
    }
    if (factors.includes("execution") || factors.includes("execution_risk")) {
      parts.push(
        "Риск исполнительного производства или ФССП — наивысший приоритет."
      );
    }
    if (factors.includes("multiple_deadlines")) {
      parts.push("Несколько сроков — ориентируемся на ближайший.");
    }

    parts.push(
      `Выделено ${formatMoney(allocated, locale)} (${sharePercent.toFixed(0)} % пула этого уровня).`
    );
  } else {
    parts.push(`Level ${level} (${levelLabel}) — category: ${catLabel}.`);

    if (debt.criticalNote && debt.criticalDate) {
      parts.push(`${debt.criticalNote} (deadline ${debt.criticalDate}).`);
    } else if (daysToCritical !== null && daysToCritical <= 7) {
      parts.push(`Critical deadline in ${daysToCritical} days.`);
    }

    if (daysToDue !== null && daysToDue < 0) {
      parts.push("Payment is overdue.");
    } else if (daysToDue !== null && daysToDue <= 7) {
      parts.push(`Due in ${daysToDue} days.`);
    }

    parts.push(
      `Allocated ${formatMoney(allocated, locale)} (${sharePercent.toFixed(0)}% of level pool).`
    );
  }

  return parts.join(" ");
}

/** Krátký důvod pro UI kartu */
function buildShortReason(analysis: DebtAnalysis, locale: Locale): string {
  const label = LEVEL_LABELS[analysis.level][locale];
  const cat = CATEGORY_LABELS[analysis.debt.category][locale];

  if (locale === "cs") return `${label} priorita · ${cat}`;
  if (locale === "ru") return `${label} приоритет · ${cat}`;
  return `${label} priority · ${cat}`;
}

// ─── Proporcionální alokace ────────────────────────────────────────────────

interface AllocationState {
  debtId: string;
  analysis: DebtAnalysis;
  paid: number;
  stillOwed: number;
}

/**
 * Proporcionálně rozdělí `pool` mezi dluhy stejné (nebo vyšší) priority.
 * Váha = urgencyScore × zbývající částka.
 */
function allocateProportionally(
  items: AllocationState[],
  pool: number
): Map<string, number> {
  const result = new Map<string, number>();
  if (pool <= 0 || items.length === 0) return result;

  let remaining = pool;

  // Váhy pro proporcionální dělení
  const weights = items.map((item) => ({
    id: item.debtId,
    weight: item.analysis.urgencyScore * Math.max(item.stillOwed, 1),
    cap: item.stillOwed,
  }));

  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  if (totalWeight === 0) return result;

  // První průchod — proporcionální částky
  const rawAllocations = weights.map((w) => ({
    id: w.id,
    raw: (w.weight / totalWeight) * pool,
    cap: w.cap,
  }));

  // Zaokrouhlení s respektem k limitům
  for (const alloc of rawAllocations) {
    const amount = roundMoney(Math.min(alloc.raw, alloc.cap, remaining));
    if (amount > 0) {
      result.set(alloc.id, (result.get(alloc.id) ?? 0) + amount);
      remaining -= amount;
    }
  }

  // Druhý průchod — rozdělí zbytek (zaokrouhlovací rozdíl) dle priority
  if (remaining > 0) {
    const sorted = [...items].sort(
      (a, b) => b.analysis.urgencyScore - a.analysis.urgencyScore
    );
    for (const item of sorted) {
      if (remaining <= 0) break;
      const current = result.get(item.debtId) ?? 0;
      const canAdd = item.stillOwed - current;
      if (canAdd <= 0) continue;
      const add = Math.min(canAdd, remaining);
      result.set(item.debtId, current + add);
      remaining -= add;
    }
  }

  return result;
}

// ─── Hlavní engine ─────────────────────────────────────────────────────────

/**
 * Spustí Priority Engine a vrátí kompletní doporučení plateb.
 *
 * @param profile  Finanční profil uživatele
 * @param locale   Jazyk vysvětlení (cs | ru | en)
 * @param today    Referenční datum (testovatelné)
 */
export function runPriorityEngine(
  profile: FinancialProfile,
  locale: Locale = "cs",
  today: Date = new Date()
): PrioritizationResult {
  const warnings: string[] = [];
  const available = Math.max(0, profile.availableFunds);

  // ── 1. Životní buffer ──
  const bufferPercent = calculateLifeBufferPercent(profile.incomeStability);
  const lifeBuffer = roundMoney(available * bufferPercent);
  let spendable = Math.max(0, available - lifeBuffer);

  if (profile.debts.length === 0) {
    return emptyResult(available, lifeBuffer, bufferPercent, locale);
  }

  if (available <= 0) {
    warnings.push(msgNoFunds(locale));
    return {
      recommendations: [],
      totalAllocated: 0,
      remainingFunds: 0,
      lifeBuffer: 0,
      lifeBufferPercent: bufferPercent,
      spendableFunds: 0,
      summary: msgNoFunds(locale),
      warnings,
    };
  }

  // Informace o bufferu
  warnings.push(msgLifeBuffer(lifeBuffer, bufferPercent, locale));

  // ── 2. Analýza všech dluhů ──
  const analyses = profile.debts.map((d) => analyzeDebt(d, today));

  // ── 3. Fáze A: Minimální splátky u úrovní 0–1 ──
  const allocations = new Map<string, number>();
  const states: AllocationState[] = analyses.map((a) => ({
    debtId: a.debt.id,
    analysis: a,
    paid: 0,
    stillOwed: a.debt.amount,
  }));

  for (const state of states) {
    if (spendable <= 0) break;
    if (state.analysis.level > 1) continue;

    const min = state.analysis.debt.minimumPayment;
    if (!min || min <= 0) continue;

    const pay = Math.min(min, state.stillOwed, spendable);
    if (pay > 0) {
      allocations.set(state.debtId, (allocations.get(state.debtId) ?? 0) + pay);
      state.paid += pay;
      state.stillOwed -= pay;
      spendable -= pay;
    }
  }

  // ── 4. Fáze B: Proporcionální dělení po úrovních 0 → 3 ──
  for (const level of [0, 1, 2, 3] as PriorityLevel[]) {
    if (spendable <= 0) break;

    const levelItems = states.filter(
      (s) => s.analysis.level === level && s.stillOwed > 0
    );
    if (levelItems.length === 0) continue;

    const totalOwed = levelItems.reduce((s, i) => s + i.stillOwed, 0);
    const pool = Math.min(spendable, totalOwed);

    const levelAlloc = allocateProportionally(levelItems, pool);

    for (const [debtId, amount] of levelAlloc) {
      allocations.set(debtId, (allocations.get(debtId) ?? 0) + amount);
      const state = states.find((s) => s.debtId === debtId)!;
      state.paid += amount;
      state.stillOwed -= amount;
      spendable -= amount;
    }
  }

  // ── 5. Sestavení doporučení ──
  const recommendations: PaymentRecommendation[] = [];

  for (const state of states) {
    const allocated = allocations.get(state.debtId) ?? 0;
    if (allocated <= 0) continue;

    const levelPool = states
      .filter((s) => s.analysis.level === state.analysis.level)
      .reduce((s, i) => s + (allocations.get(i.debtId) ?? 0), 0);

    const sharePercent =
      levelPool > 0 ? (allocated / levelPool) * 100 : 100;

    recommendations.push({
      debtId: state.debtId,
      creditor: state.analysis.debt.creditor,
      recommendedAmount: allocated,
      priority: state.analysis.urgencyScore,
      priorityLevel: state.analysis.level,
      reason: buildShortReason(state.analysis, locale),
      explanation: buildExplanation(
        state.analysis,
        allocated,
        sharePercent,
        locale
      ),
      category: state.analysis.debt.category,
    });
  }

  recommendations.sort((a, b) => {
    if (a.priorityLevel !== b.priorityLevel) return a.priorityLevel - b.priorityLevel;
    return b.priority - a.priority;
  });

  const totalAllocated = recommendations.reduce(
    (s, r) => s + r.recommendedAmount,
    0
  );

  const unpaid = states.filter((s) => s.stillOwed > 0);
  if (unpaid.length > 0) {
    warnings.push(msgUnpaid(unpaid.length, locale));
  }

  // Edge: více kritických dluhů najednou
  const criticalUnpaid = states.filter(
    (s) => s.analysis.level === 0 && s.stillOwed > 0
  );
  if (criticalUnpaid.length >= 2) {
    warnings.push(msgMultipleCritical(criticalUnpaid.length, locale));
  }

  // Edge: exekuce nezaplacena v plné výši
  const executionUnpaid = states.filter(
    (s) =>
      isExecutionRisk(s.analysis.debt) &&
      s.stillOwed > 0 &&
      (allocations.get(s.debtId) ?? 0) < s.analysis.debt.amount * 0.5
  );
  if (executionUnpaid.length > 0) {
    warnings.push(msgExecutionRisk(locale));
  }

  const top = recommendations[0];
  const summary = top
    ? msgSummary(top, lifeBuffer, locale)
    : msgNoAllocation(locale);

  return {
    recommendations,
    totalAllocated,
    remainingFunds: roundMoney(available - totalAllocated),
    lifeBuffer,
    lifeBufferPercent: bufferPercent,
    spendableFunds: roundMoney(available - lifeBuffer),
    summary,
    warnings,
  };
}

// ─── Lokalizované zprávy ───────────────────────────────────────────────────

function emptyResult(
  available: number,
  buffer: number,
  percent: number,
  locale: Locale
): PrioritizationResult {
  const summary =
    locale === "cs"
      ? "Zatím nemáme žádné dluhy k prioritizaci."
      : locale === "ru"
        ? "Пока нет долгов для приоритизации."
        : "No debts to prioritize yet.";

  return {
    recommendations: [],
    totalAllocated: 0,
    remainingFunds: available,
    lifeBuffer: buffer,
    lifeBufferPercent: percent,
    spendableFunds: Math.max(0, available - buffer),
    summary,
    warnings: [],
  };
}

function msgLifeBuffer(
  amount: number,
  percent: number,
  locale: Locale
): string {
  const pct = Math.round(percent * 100);
  if (locale === "cs")
    return `Rezerva na životní náklady: ${formatMoney(amount, locale)} (${pct} %).`;
  if (locale === "ru")
    return `Резерв на жизнь: ${formatMoney(amount, locale)} (${pct} %).`;
  return `Life buffer reserved: ${formatMoney(amount, locale)} (${pct}%).`;
}

function msgNoFunds(locale: Locale): string {
  if (locale === "cs")
    return "Nemáte volné prostředky. Zvažte oddlužení nebo odklad splátek.";
  if (locale === "ru")
    return "Нет свободных средств. Рассмотрите реструктуризацию долгов или отсрочку платежей.";
  return "No available funds. Consider debt restructuring.";
}

function msgUnpaid(count: number, locale: Locale): string {
  if (locale === "cs")
    return `${count} závazek(ů) tentokrát nepokryjeme — chybí prostředky i po rezervě.`;
  if (locale === "ru")
    return `${count} обязательств не покрыть — не хватает средств.`;
  return `${count} obligation(s) cannot be covered this time.`;
}

function msgSummary(
  top: PaymentRecommendation,
  buffer: number,
  locale: Locale
): string {
  if (locale === "cs")
    return `Nejdříve zaplaťte ${top.creditor} — ${formatMoney(top.recommendedAmount, locale)} (úroveň ${top.priorityLevel}). Rezerva ${formatMoney(buffer, locale)} zůstává na jídlo a dopravu.`;
  if (locale === "ru")
    return `Сначала оплатите ${top.creditor} — ${formatMoney(top.recommendedAmount, locale)} (уровень ${top.priorityLevel}). Резерв ${formatMoney(buffer, locale)} остаётся на еду и транспорт.`;
  return `Pay ${top.creditor} first — ${formatMoney(top.recommendedAmount, locale)} (level ${top.priorityLevel}). Buffer of ${formatMoney(buffer, locale)} kept for essentials.`;
}

function msgNoAllocation(locale: Locale): string {
  if (locale === "cs") return "Nepodařilo se vytvořit doporučení.";
  if (locale === "ru") return "Не удалось сформировать рекомендацию.";
  return "Could not generate recommendation.";
}

function msgMultipleCritical(count: number, locale: Locale): string {
  if (locale === "cs")
    return `⚠ ${count} kritických závazků — prostředky nestačí na všechny. Zvažte jednání s věřiteli.`;
  if (locale === "ru")
    return `⚠ ${count} критических обязательств — средств не хватает на все. Обратитесь к кредиторам.`;
  return `⚠ ${count} critical obligations — funds won't cover all. Consider negotiating with creditors.`;
}

function msgExecutionRisk(locale: Locale): string {
  if (locale === "cs")
    return "⚠ Exekuce nebo soudní výkon — doporučujeme právní konzultaci a prioritu této platby.";
  if (locale === "ru")
    return "⚠ Исполнительное производство или ФССП — рекомендуем юридическую консультацию и приоритет этого платежа.";
  return "⚠ Enforcement action risk — seek legal advice and prioritize this payment.";
}
