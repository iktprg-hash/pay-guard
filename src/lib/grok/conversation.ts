import type { FinancialProfile } from "@/lib/types/financial";
import {
  assessRecommendationReadiness,
  userWantsFullAnalysis,
} from "@/lib/grok/recommendation-readiness";

/** Conversation phase — drives Grok questioning strategy */
export type ConversationStage =
  | "greeting"
  | "initial_capture"
  | "debts_overview"
  | "available_funds"
  | "quick_recommend"
  | "full_enrichment"
  | "ready";

export interface ConversationState {
  stage: ConversationStage;
  missingFields: string[];
  nextQuestionHint: string;
  analysisMode: "gathering" | "quick" | "full";
}

const STAGE_HINTS: Record<
  ConversationStage,
  Record<"cs" | "ru" | "en", string>
> = {
  greeting: {
    cs: "Přivítej stručně. Zeptej se hned na dvě věci: kolik peněz má právě teď k dispozici a jaký je nejkritičtější závazek (věřitel + částka + termín, pokud ho zná).",
    ru: "Кратко поприветствуй. Сразу спроси две вещи: сколько денег доступно сейчас и какое обязательство самое срочное (кредитор + сумма + срок, если знает).",
    en: "Greet briefly. Immediately ask two things: how much money is available right now and the most urgent obligation (creditor + amount + deadline if known).",
  },
  initial_capture: {
    cs: "Chybí základ — zjisti volné prostředky a alespoň jeden kritický dluh. Neptej se na všechny závazky ani na mzdu.",
    ru: "Не хватает базы — узнай свободные средства и хотя бы один критический долг. Не спрашивай про все обязательства и зарплату.",
    en: "Missing basics — get available funds and at least one critical debt. Do not ask for all obligations or salary yet.",
  },
  debts_overview: {
    cs: "Uživatel má peníze, ale chybí dluh. Zeptej se jen na nejdůležitější závazek (věřitel, částka, kritický termín).",
    ru: "Деньги есть, но нет долга. Спроси только о самом важном обязательстве (кредитор, сумма, критический срок).",
    en: "User has funds but no debt yet. Ask only for the most important obligation (creditor, amount, critical deadline).",
  },
  available_funds: {
    cs: "Dluh znáš, chybí částka k rozdělení. Zeptej se, kolik peněz má právě teď k dispozici.",
    ru: "Долг известен, не хватает суммы для распределения. Спроси, сколько денег доступно прямо сейчас.",
    en: "Debt is known, missing spendable amount. Ask how much money is available right now.",
  },
  quick_recommend: {
    cs: "Máš minimum dat — IHNED dej doporučení podle Priority Engine. Na konci nabídni doplnění dalších dluhů nebo podrobnější plán.",
    ru: "Есть минимум данных — СРАЗУ дай рекомендацию по Priority Engine. В конце предложи добавить другие долги или детальный план.",
    en: "You have minimum data — give a recommendation NOW using Priority Engine output. Offer to add more debts or a detailed plan at the end.",
  },
  full_enrichment: {
    cs: "Uživatel chce podrobný plán. Doplň chybějící dluhy nebo příjem, pak aktualizuj doporučení.",
    ru: "Пользователь хочет подробный план. Дополни недостающие долги или доход, затем обнови рекомендацию.",
    en: "User wants a detailed plan. Collect missing debts or income, then refresh the recommendation.",
  },
  ready: {
    cs: "Doporučení už bylo — nabídni upřesnění, další dluhy nebo nový výpočet.",
    ru: "Рекомендация уже дана — предложи уточнения, другие долги или новый расчёт.",
    en: "Recommendation was given — offer refinements, more debts, or a fresh calculation.",
  },
};

/** Determine conversation stage from profile + user intent */
export function detectConversationStage(
  profile: FinancialProfile,
  options?: { lastUserMessage?: string; messageCount?: number }
): ConversationStage {
  const messageCount = options?.messageCount ?? 0;
  const lastUserMessage = options?.lastUserMessage ?? "";
  const readiness = assessRecommendationReadiness(profile, { lastUserMessage });

  if (messageCount <= 1) return "greeting";

  if (readiness.canRecommend) {
    return readiness.mode === "full" ? "full_enrichment" : "quick_recommend";
  }

  const hasFunds = profile.availableFunds > 0;
  const hasDebts = profile.debts.some((d) => d.creditor && d.amount > 0);

  if (!hasFunds && !hasDebts) return "initial_capture";
  if (!hasDebts) return "debts_overview";
  if (!hasFunds) return "available_funds";

  if (userWantsFullAnalysis(lastUserMessage) && readiness.shouldAskIncome) {
    return "full_enrichment";
  }

  return "initial_capture";
}

/** Missing fields — only what blocks the current mode */
export function getMissingFields(
  profile: FinancialProfile,
  options?: { lastUserMessage?: string }
): string[] {
  const missing: string[] = [];
  const readiness = assessRecommendationReadiness(profile, options);

  if (readiness.canRecommend) return missing;

  if (!profile.availableFunds || profile.availableFunds <= 0) {
    missing.push("availableFunds");
  }

  if (!profile.debts.some((d) => d.creditor && d.amount > 0)) {
    missing.push("debts");
  }

  if (readiness.shouldAskIncome && !profile.monthlyIncome) {
    missing.push("monthlyIncome");
  }

  return missing;
}

export function buildConversationState(
  profile: FinancialProfile,
  locale: "cs" | "ru" | "en",
  options?: { lastUserMessage?: string; messageCount?: number }
): ConversationState {
  const stage = detectConversationStage(profile, options);
  const readiness = assessRecommendationReadiness(profile, options);
  const missingFields = getMissingFields(profile, options);

  return {
    stage,
    missingFields,
    nextQuestionHint: STAGE_HINTS[stage][locale],
    analysisMode: readiness.mode,
  };
}

export function buildStageContext(
  profile: FinancialProfile,
  locale: "cs" | "ru" | "en",
  messageCount: number,
  lastUserMessage?: string
): string {
  const state = buildConversationState(profile, locale, {
    lastUserMessage,
    messageCount,
  });
  const readiness = assessRecommendationReadiness(profile, { lastUserMessage });

  const frame = {
    cs: {
      phase: "FÁZE",
      mode: "REŽIM",
      task: "ÚKOL",
      missing: "CHYBÍ",
      none: "nic kritického",
      critical: "KRITICKÝ DLUH",
      yes: "ano",
      no: "ne",
      quick: "rychlý (minimum dat)",
      full: "plný (podrobný plán)",
      gathering: "sběr dat",
    },
    ru: {
      phase: "ЭТАП",
      mode: "РЕЖИМ",
      task: "ЗАДАЧА",
      missing: "НЕ ХВАТАЕТ",
      none: "ничего критичного",
      critical: "КРИТИЧЕСКИЙ ДОЛГ",
      yes: "да",
      no: "нет",
      quick: "быстрый (минимум данных)",
      full: "полный (детальный план)",
      gathering: "сбор данных",
    },
    en: {
      phase: "STAGE",
      mode: "MODE",
      task: "TASK",
      missing: "MISSING",
      none: "nothing critical",
      critical: "CRITICAL DEBT",
      yes: "yes",
      no: "no",
      quick: "quick (minimum data)",
      full: "full (detailed plan)",
      gathering: "gathering data",
    },
  }[locale];

  const modeLabel =
    readiness.mode === "quick"
      ? frame.quick
      : readiness.mode === "full"
        ? frame.full
        : frame.gathering;

  if (messageCount <= 1) {
    return `${frame.phase}: greeting
${frame.mode}: ${modeLabel}
${frame.task}: ${STAGE_HINTS.greeting[locale]}`;
  }

  return `${frame.phase}: ${state.stage}
${frame.mode}: ${modeLabel}
${frame.critical}: ${readiness.hasCriticalDebt ? frame.yes : frame.no}
${frame.missing}: ${state.missingFields.length ? state.missingFields.join(", ") : frame.none}
CAN_RECOMMEND_NOW: ${readiness.canRecommend ? "yes" : "no"}
${frame.task}: ${state.nextQuestionHint}`;
}
