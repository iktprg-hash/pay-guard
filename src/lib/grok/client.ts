import {
  buildSystemPrompt,
  mergeProfileUpdate,
  parseProfileUpdate,
  stripProfileUpdate,
} from "@/lib/grok/prompts";
import {
  buildConversationState,
  type ConversationStage,
} from "@/lib/grok/conversation";
import { minimizeProfileForGrok } from "@/lib/grok/minimize-profile";
import type { FinancialProfile } from "@/lib/types/financial";

export interface GrokMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GrokChatResult {
  message: string;
  profileUpdate: Partial<FinancialProfile> & {
    readyForRecommendation?: boolean;
  } | null;
  stage: ConversationStage;
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
  locale: "cs" | "ru" | "en" = "cs"
): Promise<GrokChatResult> {
  const userMessages = messages.filter((m) => m.role === "user");
  const safeProfile = minimizeProfileForGrok(profile);
  const state = buildConversationState(safeProfile, locale);
  const apiKey = process.env.XAI_API_KEY;
  const isProd = process.env.NODE_ENV === "production";

  if (!apiKey) {
    if (isProd) {
      throw new GrokUnavailableError();
    }

    const mockStage =
      userMessages.length <= 1 && safeProfile.debts.length === 0
        ? "greeting"
        : state.stage;
    return getMockResponse(userMessages, safeProfile, locale, mockStage);
  }

  const systemMessage: GrokMessage = {
    role: "system",
    content: buildSystemPrompt(locale, safeProfile, messages.length),
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
      temperature: 0.7,
      max_tokens: 1500,
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

  return {
    message: stripProfileUpdate(rawContent),
    profileUpdate,
    stage:     profileUpdate
      ? buildConversationState(
          mergeProfileUpdate(safeProfile, profileUpdate),
          locale
        ).stage
      : state.stage,
  };
}

/** Mock odpovědi podle fáze konverzace */
function getMockResponse(
  userMessages: GrokMessage[],
  profile: FinancialProfile,
  locale: "cs" | "ru" | "en",
  stage: ConversationStage
): GrokChatResult {
  const lastUser = userMessages[userMessages.length - 1];
  const userText = lastUser?.content ?? "";

  const mockByStage: Record<
    ConversationStage,
    Record<"cs" | "ru" | "en", { message: string; update?: Partial<FinancialProfile> & { readyForRecommendation?: boolean } }>
  > = {
    greeting: {
      cs: {
        message:
          "Dobrý den! Jsem Pay Guard a jsem tu, abych vám pomohl s prioritami plateb.\n\nZačněme jednoduše — **jaké závazky vás teď nejvíc trápí?** Napište mi věřitele a částku, třeba nájem nebo energie.",
      },
      ru: {
        message:
          "Здравствуйте! Я Pay Guard — помогу расставить приоритеты платежей.\n\n**Какие обязательства вас сейчас больше всего беспокоят?** Напишите кредитора и сумму.",
      },
      en: {
        message:
          "Hello! I'm Pay Guard — here to help you prioritize payments.\n\n**What obligations worry you most right now?** Tell me the creditor and amount.",
      },
    },
    debts_overview: {
      cs: {
        message:
          "Rozumím. Máte ještě další závazky? Například energie, půjčka od banky, pokuta nebo kreditní karta?\n\nPokud ne, pojďme upřesnit **splatnost** u těch, co jste zmínil.",
      },
      ru: {
        message:
          "Понятно. Есть ли ещё обязательства — коммуналка, кредит, штраф?\n\nЕсли нет, уточним **сроки** по уже названным.",
      },
      en: {
        message:
          "Got it. Any other obligations — utilities, bank loan, fines?\n\nIf not, let's clarify **due dates** for what you mentioned.",
      },
    },
    debt_details: {
      cs: {
        message:
          "Díky za upřesnění. **Kdy je splatnost** u těchto závazků? A je nějaký kritický termín — třeba hrozící vystěhování nebo exekuce?",
      },
      ru: {
        message:
          "Спасибо. **Когда срок оплаты** по этим обязательствам? Есть критическая дата — выселение, исполнительное производство?",
      },
      en: {
        message:
          "Thanks. **When are these due?** Any critical deadline — eviction, enforcement action?",
      },
    },
    income: {
      cs: {
        message:
          "To mám zaznamenané. Teď k příjmům — **kolik měsíčně dostáváte na účet?** A je to stabilní, nebo příjem kolísá?",
      },
      ru: {
        message:
          "Записал. Теперь о доходе — **сколько в месяц поступает на счёт?** Стабильный доход или переменный?",
      },
      en: {
        message:
          "Noted. Now about income — **how much do you receive monthly?** Is it stable or does it vary?",
      },
    },
    available_funds: {
      cs: {
        message:
          "Děkuji. Poslední klíčová otázka: **kolik peněz máte právě teď k dispozici** na splátky? Stačí orientační částka.",
      },
      ru: {
        message:
          "Спасибо. Последний вопрос: **сколько денег доступно прямо сейчас** на платежи?",
      },
      en: {
        message:
          "Thank you. Last key question: **how much money do you have available right now** for payments?",
      },
    },
    confirmation: {
      cs: {
        message:
          "Shrnu, co vím — zkontrolujte prosím, zda je to správně. Pak připravím doporučení priorit.",
      },
      ru: {
        message: "Подведу итог — проверьте, всё ли верно. Затем подготовлю рекомендации.",
      },
      en: {
        message: "Let me summarize — please confirm if this is correct. Then I'll prepare priorities.",
      },
    },
    ready: {
      cs: {
        message:
          "Mám dostatek informací. Shrnu vaši situaci a mohu připravit **doporučení priorit plateb** — stiskněte tlačítko níže.",
        update: { readyForRecommendation: true },
      },
      ru: {
        message:
          "Достаточно данных. Могу подготовить **рекомендации по приоритетам** — нажмите кнопку ниже.",
        update: { readyForRecommendation: true },
      },
      en: {
        message:
          "I have enough information. I can prepare **payment priority recommendations** — press the button below.",
        update: { readyForRecommendation: true },
      },
    },
  };

  const amountMatch = userText.match(/(\d[\d\s.,]*)/);
  const amount = amountMatch
    ? parseInt(amountMatch[1].replace(/[\s.,]/g, ""), 10)
    : 0;

  let update: (Partial<FinancialProfile> & { readyForRecommendation?: boolean }) | undefined;
  const mockDebts = [...profile.debts];

  if (amount > 0 && stage === "debts_overview" && mockDebts.length === 0) {
    const isRent = /nájem|rent|аренд|жкх|квартир|наём/i.test(userText);
    const creditorByLocale = {
      cs: isRent ? "Nájem" : "Věřitel",
      ru: isRent ? "Аренда" : "Кредитор",
      en: isRent ? "Rent" : "Creditor",
    };
    mockDebts.push({
      id: "debt-mock-1",
      creditor: creditorByLocale[locale],
      amount,
      category: isRent ? "housing" : "other",
    });
    update = { debts: mockDebts };
  } else if (amount > 0 && stage === "income") {
    update = { monthlyIncome: amount, incomeStability: "stable" };
  } else if (amount > 0 && stage === "available_funds") {
    update = {
      availableFunds: amount,
      debts: mockDebts,
      readyForRecommendation: mockDebts.length > 0,
    };
  }

  const response = mockByStage[stage][locale];
  const demoNote = {
    cs: "\n\n_*(Demo režim — nastavte XAI_API_KEY pro plný Grok chat)*_",
    ru: "\n\n_*(Демо-режим — задайте XAI_API_KEY для полного Grok-чата)*_",
    en: "\n\n_*(Demo mode — set XAI_API_KEY for full Grok chat)*_",
  }[locale];

  return {
    message: response.message + demoNote,
    profileUpdate: update ?? response.update ?? null,
    stage,
  };
}
