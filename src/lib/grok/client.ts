import {
  buildSystemPrompt,
  mergeProfileUpdate,
  parseProfileUpdate,
  stripProfileUpdate,
  type SystemPromptOptions,
} from "@/lib/grok/prompts";
import {
  buildConversationState,
  type ConversationStage,
} from "@/lib/grok/conversation";
import {
  assessRecommendationReadiness,
  type AnalysisMode,
} from "@/lib/grok/recommendation-readiness";
import { minimizeProfileForGrok } from "@/lib/grok/minimize-profile";
import type { FinancialProfile, PrioritizationResult } from "@/lib/types/financial";

export interface GrokMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GrokChatOptions {
  lastUserMessage?: string;
  engineResult?: PrioritizationResult | null;
}

export interface GrokChatResult {
  message: string;
  profileUpdate: Partial<FinancialProfile> & {
    readyForRecommendation?: boolean;
    analysisMode?: AnalysisMode | null;
  } | null;
  stage: ConversationStage;
  readyForRecommendation: boolean;
  analysisMode: AnalysisMode;
  recommendation: PrioritizationResult | null;
}

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_MODEL = "grok-3-mini";

export class GrokUnavailableError extends Error {
  constructor(message = "Grok API is not configured") {
    super(message);
    this.name = "GrokUnavailableError";
  }
}

export class GrokRequestError extends Error {
  readonly status: number;

  constructor(status: number, message = "Grok API request failed") {
    super(message);
    this.name = "GrokRequestError";
    this.status = status;
  }
}

/**
 * Volá xAI Grok API pro konverzační odpověď.
 * Mock odpovědi pouze v dev bez API klíče — v produkci 503.
 */
export async function chatWithGrok(
  messages: GrokMessage[],
  profile: FinancialProfile,
  locale: "cs" | "ru" | "en" = "cs",
  options?: GrokChatOptions
): Promise<GrokChatResult> {
  const userMessages = messages.filter((m) => m.role === "user");
  const lastUserMessage =
    options?.lastUserMessage ??
    userMessages[userMessages.length - 1]?.content ??
    "";
  const safeProfile = minimizeProfileForGrok(profile);
  const messageCount = messages.length;

  const state = buildConversationState(safeProfile, locale, {
    lastUserMessage,
    messageCount,
  });
  const readiness = assessRecommendationReadiness(safeProfile, {
    lastUserMessage,
  });

  const apiKey = process.env.XAI_API_KEY;
  const isProd = process.env.NODE_ENV === "production";

  if (!apiKey) {
    if (isProd) {
      throw new GrokUnavailableError();
    }

    return getMockResponse(
      userMessages,
      safeProfile,
      locale,
      state.stage,
      options?.engineResult ?? null,
      lastUserMessage
    );
  }

  const promptOptions: SystemPromptOptions = {
    lastUserMessage,
    engineResult: options?.engineResult,
  };

  const systemMessage: GrokMessage = {
    role: "system",
    content: buildSystemPrompt(
      locale,
      safeProfile,
      messageCount,
      promptOptions
    ),
  };

  const response = await fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL ?? DEFAULT_MODEL,
      messages: [systemMessage, ...messages.filter((m) => m.role !== "system")],
      temperature: 0.65,
      max_tokens: 1800,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[grok] API error ${response.status}:`,
      errorText.slice(0, 300)
    );
    throw new GrokRequestError(response.status);
  }

  const data = await response.json();
  const rawContent: string = data.choices?.[0]?.message?.content ?? "";
  const profileUpdate = parseProfileUpdate(rawContent);
  const merged = profileUpdate
    ? mergeProfileUpdate(safeProfile, profileUpdate)
    : safeProfile;
  const postReadiness = assessRecommendationReadiness(merged, { lastUserMessage });

  const readyForRecommendation =
    postReadiness.canRecommend || Boolean(profileUpdate?.readyForRecommendation);

  return {
    message: stripProfileUpdate(rawContent),
    profileUpdate: profileUpdate
      ? {
          ...profileUpdate,
          readyForRecommendation,
          analysisMode: postReadiness.mode === "gathering" ? null : postReadiness.mode,
        }
      : null,
    stage: buildConversationState(merged, locale, {
      lastUserMessage,
      messageCount,
    }).stage,
    readyForRecommendation,
    analysisMode: postReadiness.mode,
    recommendation:
      postReadiness.shouldAutoDeliver && options?.engineResult
        ? options.engineResult
        : null,
  };
}

/** Mock odpovědi — rychlý režim s Priority Engine */
function getMockResponse(
  userMessages: GrokMessage[],
  profile: FinancialProfile,
  locale: "cs" | "ru" | "en",
  stage: ConversationStage,
  engineResult: PrioritizationResult | null,
  lastUserMessage: string
): GrokChatResult {
  const userText = userMessages[userMessages.length - 1]?.content ?? "";
  const amountMatch = userText.match(/(\d[\d\s.,]*)/);
  const amount = amountMatch
    ? parseInt(amountMatch[1].replace(/[\s.,]/g, ""), 10)
    : 0;

  let update: (Partial<FinancialProfile> & {
    readyForRecommendation?: boolean;
    analysisMode?: AnalysisMode | null;
  }) | undefined;
  const mockDebts = [...profile.debts];

  const isRent = /nájem|rent|аренд|жкх|квартир|наём|byt/i.test(userText);
  const hasCriticalHint = /exeku|výpov|vypov|фссп|пристав|vystěh|vysteh|odpoj/i.test(
    userText
  );

  if (amount > 0 && mockDebts.length === 0) {
    if (profile.availableFunds <= 0) {
      update = { availableFunds: amount };
    } else {
      mockDebts.push({
        id: "debt-mock-1",
        creditor: isRent
          ? { cs: "Nájem", ru: "Аренда", en: "Rent" }[locale]
          : { cs: "Nejdůležitější závazek", ru: "Главный долг", en: "Top debt" }[
              locale
            ],
        amount,
        category: isRent ? "housing" : "other",
        criticalDate: hasCriticalHint ? "2026-06-13" : undefined,
      });
      update = { debts: mockDebts };
    }
  } else if (amount > 0 && profile.availableFunds <= 0) {
    update = { availableFunds: amount, debts: mockDebts };
  }

  const merged = update ? mergeProfileUpdate(profile, update) : profile;
  const readiness = assessRecommendationReadiness(merged, { lastUserMessage });

  const demoNote = {
    cs: "\n\n_*(Demo režim — nastavte XAI_API_KEY pro plný Grok chat)*_",
    ru: "\n\n_*(Демо-режим — задайте XAI_API_KEY для полного Grok-чата)*_",
    en: "\n\n_*(Demo mode — set XAI_API_KEY for full Grok chat)*_",
  }[locale];

  if (readiness.canRecommend && engineResult) {
    const top = engineResult.recommendations[0];
    const bufferPct = Math.round(engineResult.lifeBufferPercent * 100);
    const quickMessages = {
      cs: `Rozumím situaci — pojďme začít s nejdůležitějším.

**Doporučení:** jako první ${top?.creditor ?? "prioritní závazek"} — alokujte prostředky dle Priority Engine (viz tlačítko níže pro detail).

**Life buffer:** rezerva ${engineResult.lifeBuffer.toLocaleString("cs-CZ")} Kč (${bufferPct} %) zůstává na jídlo a nezbytné výdaje.

**Proč:** kritické termíny a esenciální výdaje mají přednost před běžnými půjčkami.

Chcete doplnit další dluhy, nebo upřesnit částky pro podrobnější plán?`,
      ru: `Понимаю ситуацию — давайте начнём с самого важного.

**Рекомендация:** в первую очередь ${top?.creditor ?? "приоритетный долг"} — распределение по Priority Engine (кнопка ниже для деталей).

**Life buffer:** резерв ${engineResult.lifeBuffer.toLocaleString("ru-RU")} ₽ (${bufferPct} %) остаётся на еду и базовые расходы.

**Почему:** критические сроки и обязательные расходы важнее обычных кредитов.

Хотите добавить другие долги или уточнить суммы для детального плана?`,
      en: `I understand — let's start with what matters most.

**Recommendation:** pay ${top?.creditor ?? "the priority creditor"} first — see Priority Engine details below.

**Life buffer:** reserve ${engineResult.lifeBuffer.toLocaleString("en-US")} (${bufferPct}%) kept for food and essentials.

**Why:** critical deadlines and essential bills come before ordinary loans.

Would you like to add other debts or refine amounts for a detailed plan?`,
    };

    return {
      message: quickMessages[locale] + demoNote,
      profileUpdate: {
        ...update,
        readyForRecommendation: true,
        analysisMode: readiness.mode === "gathering" ? null : readiness.mode,
      },
      stage: "quick_recommend",
      readyForRecommendation: true,
      analysisMode: readiness.mode,
      recommendation: engineResult,
    };
  }

  const gatheringMessages: Record<
    ConversationStage,
    Record<"cs" | "ru" | "en", string>
  > = {
    greeting: {
      cs: "Dobrý den! Jsem Pay Guard — pomohu vám rychle rozhodnout, kam poslat peníze.\n\n**Kolik máte právě teď k dispozici** a **jaký je nejkritičtější závazek** (věřitel + částka)?",
      ru: "Здравствуйте! Я Pay Guard — быстро помогу решить, куда направить деньги.\n\n**Сколько у вас доступно сейчас** и **какое обязательство самое срочное** (кредитор + сумма)?",
      en: "Hello! I'm Pay Guard — I'll help you decide where to send money fast.\n\n**How much do you have available now** and **what's the most urgent obligation** (creditor + amount)?",
    },
    initial_capture: {
      cs: "Pojďme na to rychle — **kolik peněz máte teď** a **který dluh nejvíc hoří** (částka + věřitel)?",
      ru: "Давайте быстро — **сколько денег сейчас** и **какой долг самый срочный**?",
      en: "Let's move fast — **how much money now** and **which debt is most urgent**?",
    },
    debts_overview: {
      cs: "Kolik máte k dispozici už víme. **Jaký je nejdůležitější závazek** (věřitel + částka + termín)?",
      ru: "Сумму мы знаем. **Какое обязательство главное** (кредитор + сумма + срок)?",
      en: "We know the amount. **What's the top obligation** (creditor + amount + deadline)?",
    },
    available_funds: {
      cs: "Závazek mám. **Kolik peněz máte právě teď** na splátky?",
      ru: "Долг записал. **Сколько денег доступно прямо сейчас**?",
      en: "Got the debt. **How much money is available right now**?",
    },
    quick_recommend: {
      cs: "Pojďme na to rychle — **kolik peněz máte teď** a **který dluh nejvíc hoří** (částka + věřitel)?",
      ru: "Давайте быстро — **сколько денег сейчас** и **какой долг самый срочный**?",
      en: "Let's move fast — **how much money now** and **which debt is most urgent**?",
    },
    full_enrichment: {
      cs: "Chcete podrobnější plán — **máte ještě další dluhy**, nebo kolísá příjem?",
      ru: "Нужен подробный план — **есть ещё долги** или нестабильный доход?",
      en: "For a detailed plan — **any other debts** or unstable income?",
    },
    ready: {
      cs: "Pojďme na to rychle — **kolik peněz máte teď** a **který dluh nejvíc hoří** (částka + věřitel)?",
      ru: "Давайте быстро — **сколько денег сейчас** и **какой долг самый срочный**?",
      en: "Let's move fast — **how much money now** and **which debt is most urgent**?",
    },
  };

  const messageKey = stage in gatheringMessages ? stage : "initial_capture";

  return {
    message: gatheringMessages[messageKey][locale] + demoNote,
    profileUpdate: update ?? null,
    stage,
    readyForRecommendation: readiness.canRecommend,
    analysisMode: readiness.mode,
    recommendation: null,
  };
}
