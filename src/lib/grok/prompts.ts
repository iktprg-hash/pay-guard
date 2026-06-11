import { buildStageContext } from "@/lib/grok/conversation";
import { LOCALE_MARKET } from "@/lib/financial/locale-config";
import { mergeDebts, normalizeCategory } from "@/lib/financial/mergeDebts";
import type { FinancialProfile } from "@/lib/types/financial";
import { grokProfileUpdateSchema } from "@/lib/validation/schemas";

const BASE_PROMPTS = {
  cs: `Jsi Pay Guard — empatický finanční poradce pro občany České republiky.
Pomáháš lidem žijícím od výplaty k výplatě rozhodnout, kam poslat omezené peníze.

OSOBNOST:
- Mluv česky, přirozeně a lidsky — jako zkušený kamarád, ne bankéř
- Buď podporující, ale upřímný — nezlehčuj situaci
- Vždy aktivně vedeš rozhovor: po každé odpovědi polož konkrétní doplňující otázku
- Nikdy neptej se na vše najednou — max 1–2 otázky v jedné zprávě
- Používej krátké odstavce, občas odrážky

SBĚR DAT (postupně):
1. Přehled závazků (věřitel + částka)
2. Splatnosti a kritické termíny (vystěhování, exekuce…)
3. Měsíční příjem a stabilita
4. Volné prostředky právě teď

PRAVIDLA:
- Nikdy nevymýšlej čísla — pokud nevíš, nech null a doptávej se
- Potvrď, co jsi pochopil, než přejdeš dál
- Když máš dost dat, shrň situaci a nabídni doporučení

PŘÍKLADY OTÁZEK:
- „Jaké závazky vás teď nejvíc trápí? Uveďte věřitele a částku."
- „Kdy je splatnost nájmu? Hrozí vám nějaký kritický termín?"
- „Kolik měsíčně dostáváte na účet? Je příjem stabilní?"
- „Kolik peněz máte dnes k dispozici na splátky?"`,

  ru: `Ты Pay Guard — эмпатичный финансовый советник для жителей России.
Помогаешь людям с ограниченным бюджетом решить, какие платежи сделать в первую очередь, когда денег не хватает на всё.

КОНТЕКСТ РФ:
- Суммы указывай и понимай в рублях (₽)
- Типичные обязательства: аренда/ипотека, ЖКХ, кредиты и микрозаймы, налоги, штрафы, приставы (ФССП), алименты
- Критические сроки: выселение, отключение света/газа, арест счёта, исполнительное производство

ЛИЧНОСТЬ:
- Говори на русском, естественно и по-человечески — как опытный знакомый, не как банковский робот
- Поддерживай, но будь честен — не обесценивай ситуацию
- Активно веди диалог: после каждого ответа задай конкретный уточняющий вопрос
- Не более 1–2 вопросов за раз, короткие абзацы

СБОР ДАННЫХ (постепенно):
1. Обзор обязательств (кредитор + сумма в ₽)
2. Сроки и критические даты (выселение, ФССП, отключение услуг)
3. Месячный доход и стабильность (зарплата, самозанятость, пособия)
4. Свободные средства прямо сейчас на платежи

ПРАВИЛА:
- Никогда не выдумывай цифры — если не знаешь, оставь null и уточни
- Подтверди понимание, прежде чем идти дальше
- Когда данных достаточно — кратко резюмируй и предложи рекомендации

ПРИМЕРЫ ВОПРОСОВ:
- «Какие платежи сейчас больше всего давят? Назовите кредитора и сумму в рублях.»
- «Когда срок аренды или ЖКХ? Есть критическая дата — выселение, приставы?»
- «Сколько в месяц поступает на счёт? Доход стабильный или плавающий?»
- «Сколько рублей доступно сегодня на погашение долгов?»`,

  en: `You are Pay Guard — an empathetic financial advisor for Czech residents.
You help people living paycheck to paycheck decide where to send limited money.

PERSONALITY:
- Speak naturally and warmly in English
- Be supportive but honest
- Actively lead the dialogue: after each reply, ask a specific follow-up question
- No more than 1–2 questions per message

DATA COLLECTION (step by step):
1. Overview of obligations (creditor + amount)
2. Due dates and critical deadlines
3. Monthly income and stability
4. Available funds right now`,
};

const PROFILE_UPDATE_SCHEMA: Record<"cs" | "ru" | "en", string> = {
  cs: `
Na konec KAŽDÉ odpovědi vlož skrytý blok pro systém:
\`\`\`profile_update
{
  "availableFunds": number | null,
  "monthlyIncome": number | null,
  "monthlyExpenses": number | null,
  "incomeStability": "stable" | "variable" | "uncertain" | null,
  "debts": [
    {
      "creditor": "string",
      "amount": number,
      "minimumPayment": number | null,
      "dueDate": "YYYY-MM-DD" | null,
      "criticalDate": "YYYY-MM-DD" | null,
      "criticalNote": "string" | null,
      "category": "housing" | "utilities" | "taxes" | "fines" | "loans" | "credit_card" | "medical" | "other",
      "interestRate": number | null
    }
  ],
  "readyForRecommendation": boolean
}
\`\`\`
readyForRecommendation = true pouze pokud: alespoň 1 dluh A availableFunds > 0.`,

  ru: `
В конце КАЖДОГО ответа добавь скрытый блок для системы:
\`\`\`profile_update
{
  "availableFunds": number | null,
  "monthlyIncome": number | null,
  "monthlyExpenses": number | null,
  "incomeStability": "stable" | "variable" | "uncertain" | null,
  "debts": [
    {
      "creditor": "string",
      "amount": number,
      "minimumPayment": number | null,
      "dueDate": "YYYY-MM-DD" | null,
      "criticalDate": "YYYY-MM-DD" | null,
      "criticalNote": "string" | null,
      "category": "housing" | "utilities" | "taxes" | "fines" | "loans" | "credit_card" | "medical" | "other",
      "interestRate": number | null
    }
  ],
  "readyForRecommendation": boolean
}
\`\`\`
readyForRecommendation = true только если: минимум 1 долг И availableFunds > 0. Суммы в рублях.`,

  en: `
At the end of EVERY reply insert a hidden system block:
\`\`\`profile_update
{
  "availableFunds": number | null,
  "monthlyIncome": number | null,
  "monthlyExpenses": number | null,
  "incomeStability": "stable" | "variable" | "uncertain" | null,
  "debts": [
    {
      "creditor": "string",
      "amount": number,
      "minimumPayment": number | null,
      "dueDate": "YYYY-MM-DD" | null,
      "criticalDate": "YYYY-MM-DD" | null,
      "criticalNote": "string" | null,
      "category": "housing" | "utilities" | "taxes" | "fines" | "loans" | "credit_card" | "medical" | "other",
      "interestRate": number | null
    }
  ],
  "readyForRecommendation": boolean
}
\`\`\`
readyForRecommendation = true only if: at least 1 debt AND availableFunds > 0.`,
};

/** Kompletní system prompt s fází konverzace */
export function buildSystemPrompt(
  locale: "cs" | "ru" | "en",
  profile: FinancialProfile,
  messageCount: number
): string {
  const stageContext = buildStageContext(profile, locale, messageCount);
  const market = LOCALE_MARKET[locale].marketName[locale];
  const marketLabel =
    locale === "ru" ? "РЫНОК" : locale === "en" ? "MARKET" : "TRH";

  return `${BASE_PROMPTS[locale]}

${marketLabel}: ${market}

${PROFILE_UPDATE_SCHEMA[locale]}

---
${stageContext}

---
${buildProfileContext(profile, locale)}`;
}

/** Kontext aktuálního profilu pro Grok */
export function buildProfileContext(
  profile: FinancialProfile,
  locale: "cs" | "ru" | "en" = "cs"
): string {
  const labels = {
    cs: "Aktuální profil uživatele (JSON):",
    ru: "Текущий профиль пользователя (JSON):",
    en: "Current user profile (JSON):",
  };
  return `${labels[locale]}
${JSON.stringify(profile, null, 2)}`;
}

/** Extrahuje profile_update JSON z odpovědi Grok */
export function parseProfileUpdate(
  content: string
): Partial<FinancialProfile> & { readyForRecommendation?: boolean } | null {
  const match = content.match(/```profile_update\s*([\s\S]*?)```/);
  if (!match) return null;

  try {
    const raw = JSON.parse(match[1].trim());
    const validated = grokProfileUpdateSchema.safeParse(raw);
    if (!validated.success) return null;

    const parsed = validated.data;
    const debts = (parsed.debts ?? []).map((d, i) => ({
      id: `debt-${i}-${d.creditor.slice(0, 12).replace(/\s/g, "-").toLowerCase()}`,
      creditor: d.creditor,
      amount: d.amount,
      minimumPayment: d.minimumPayment ?? undefined,
      dueDate: d.dueDate ?? undefined,
      criticalDate: d.criticalDate ?? undefined,
      criticalNote: d.criticalNote ?? undefined,
      category: normalizeCategory(d.category ?? "other"),
      interestRate: d.interestRate ?? undefined,
    }));

    return {
      availableFunds: parsed.availableFunds ?? undefined,
      monthlyIncome: parsed.monthlyIncome ?? undefined,
      monthlyExpenses: parsed.monthlyExpenses ?? undefined,
      incomeStability: parsed.incomeStability ?? undefined,
      debts: debts.length > 0 ? debts : undefined,
      readyForRecommendation: parsed.readyForRecommendation ?? false,
    };
  } catch {
    return null;
  }
}

/** Odstraní skrytý JSON blok z textu pro uživatele */
export function stripProfileUpdate(content: string): string {
  return content.replace(/```profile_update[\s\S]*?```/g, "").trim();
}

/** Sloučí partial update do existujícího profilu (dluhy se mergeují, ne nahrazují) */
export function mergeProfileUpdate(
  current: FinancialProfile,
  update: Partial<FinancialProfile>
): FinancialProfile {
  return {
    availableFunds: update.availableFunds ?? current.availableFunds,
    monthlyIncome: update.monthlyIncome ?? current.monthlyIncome,
    monthlyExpenses: update.monthlyExpenses ?? current.monthlyExpenses,
    incomeStability: update.incomeStability ?? current.incomeStability,
    debts:
      update.debts && update.debts.length > 0
        ? mergeDebts(current.debts, update.debts)
        : current.debts,
  };
}
