import type { FinancialProfile } from "@/lib/types/financial";

/** Fáze konverzace — řídí aktivní dotazování Grok */
export type ConversationStage =
  | "greeting"
  | "debts_overview"
  | "debt_details"
  | "income"
  | "available_funds"
  | "confirmation"
  | "ready";

export interface ConversationState {
  stage: ConversationStage;
  missingFields: string[];
  nextQuestionHint: string;
}

const STAGE_HINTS: Record<
  ConversationStage,
  Record<"cs" | "ru" | "en", string>
> = {
  greeting: {
    cs: "Přivítej uživatele a zeptej se, jaká je jeho finanční situace. Buď vřelý, ale stručný.",
    ru: "Поприветствуй пользователя и спроси о его финансовой ситуации. Тепло, но кратко.",
    en: "Greet the user and ask about their financial situation. Be warm but concise.",
  },
  debts_overview: {
    cs: "Zeptej se na všechny závazky — nájem, energie, půjčky, pokuty. Požádej o věřitele a částku u každého.",
    ru: "Спроси обо всех обязательствах — аренда, коммуналка, кредиты, штрафы. Попроси кредитора и сумму.",
    en: "Ask about all obligations — rent, utilities, loans, fines. Request creditor and amount for each.",
  },
  debt_details: {
    cs: "Upřesni u závazků splatnost a kritické termíny (např. vystěhování, exekuce). Ptej se na jeden dluh najednou.",
    ru: "Уточни сроки и критические даты (выселение, исполнительное производство). Спрашивай по одному долгу.",
    en: "Clarify due dates and critical deadlines (eviction, enforcement). Ask about one debt at a time.",
  },
  income: {
    cs: "Zeptej se na měsíční příjem a zda je stabilní, nebo kolísá.",
    ru: "Спроси о месячном доходе и его стабильности.",
    en: "Ask about monthly income and whether it is stable or variable.",
  },
  available_funds: {
    cs: "Zeptej se, kolik peněz má uživatel právě teď k dispozici na splátky.",
    ru: "Спроси, сколько денег доступно прямо сейчас на платежи.",
    en: "Ask how much money the user has available right now for payments.",
  },
  confirmation: {
    cs: "Shrň nasbírané údaje a ověř, zda je vše správně. Zeptej se, zda něco chybí.",
    ru: "Подведи итог собранных данных и уточни, всё ли верно.",
    en: "Summarize collected data and confirm everything is correct.",
  },
  ready: {
    cs: "Máš dostatek dat. Shrň situaci empaticky a nabídni přípravu doporučení priorit plateb.",
    ru: "Достаточно данных. Кратко подведи итог и предложи подготовить рекомендации.",
    en: "You have enough data. Summarize empathetically and offer to prepare payment priorities.",
  },
};

/** Určí aktuální fázi konverzace podle profilu */
export function detectConversationStage(
  profile: FinancialProfile
): ConversationStage {
  if (profile.debts.length === 0) return "debts_overview";

  const hasIncompleteDebt = profile.debts.some(
    (d) => !d.dueDate && !d.criticalDate
  );
  if (hasIncompleteDebt) return "debt_details";

  if (!profile.monthlyIncome && !profile.incomeStability) return "income";

  if (!profile.availableFunds || profile.availableFunds <= 0) {
    return "available_funds";
  }

  if (profile.debts.length > 0 && profile.availableFunds > 0) {
    return "ready";
  }

  return "confirmation";
}

/** Vrátí chybějící pole pro aktivní dotazování */
export function getMissingFields(profile: FinancialProfile): string[] {
  const missing: string[] = [];

  if (profile.debts.length === 0) {
    missing.push("debts");
    return missing;
  }

  for (const debt of profile.debts) {
    if (!debt.creditor) missing.push(`debt.${debt.id}.creditor`);
    if (!debt.amount) missing.push(`debt.${debt.id}.amount`);
    if (!debt.dueDate && !debt.criticalDate) {
      missing.push(`debt.${debt.id}.dates`);
    }
  }

  if (!profile.monthlyIncome) missing.push("monthlyIncome");
  if (!profile.incomeStability) missing.push("incomeStability");
  if (!profile.availableFunds || profile.availableFunds <= 0) {
    missing.push("availableFunds");
  }

  return missing;
}

/** Stav konverzace pro system prompt */
export function buildConversationState(
  profile: FinancialProfile,
  locale: "cs" | "ru" | "en"
): ConversationState {
  const stage = detectConversationStage(profile);
  const missingFields = getMissingFields(profile);

  return {
    stage,
    missingFields,
    nextQuestionHint: STAGE_HINTS[stage][locale],
  };
}

/** Kontext fáze pro Grok system prompt */
export function buildStageContext(
  profile: FinancialProfile,
  locale: "cs" | "ru" | "en",
  messageCount: number
): string {
  const state = buildConversationState(profile, locale);

  if (messageCount <= 1) {
    return `FÁZE: greeting\nÚKOL: ${STAGE_HINTS.greeting[locale]}`;
  }

  return `FÁZE KONVERZACE: ${state.stage}
CHYBĚJÍCÍ ÚDAJE: ${state.missingFields.length ? state.missingFields.join(", ") : "žádné"}
DALŠÍ OTÁZKA (polož ji přirozeně v odpovědi): ${state.nextQuestionHint}`;
}
