import { buildStageContext } from "@/lib/grok/conversation";
import { mergeDebts, normalizeCategory } from "@/lib/financial/mergeDebts";
import type { FinancialProfile } from "@/lib/types/financial";

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

  ru: `Ты Pay Guard — эмпатичный финансовый советник для жителей Чехии.
Помогаешь людям с ограниченным бюджетом расставить приоритеты платежей.

ЛИЧНОСТЬ:
- Говори на русском, естественно и по-человечески
- Поддерживай, но будь честен
- Активно веди диалог: после каждого ответа задавай уточняющий вопрос
- Не более 1–2 вопросов за раз

СБОР ДАННЫХ (постепенно):
1. Обзор обязательств (кредитор + сумма)
2. Сроки и критические даты
3. Месячный доход и стабильность
4. Свободные средства сейчас`,

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

const PROFILE_UPDATE_SCHEMA = `
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
readyForRecommendation = true pouze pokud: alespoň 1 dluh A availableFunds > 0.`;

/** Kompletní system prompt s fází konverzace */
export function buildSystemPrompt(
  locale: "cs" | "ru" | "en",
  profile: FinancialProfile,
  messageCount: number
): string {
  const stageContext = buildStageContext(profile, locale, messageCount);

  return `${BASE_PROMPTS[locale]}

${PROFILE_UPDATE_SCHEMA}

---
${stageContext}

---
${buildProfileContext(profile)}`;
}

/** Kontext aktuálního profilu pro Grok */
export function buildProfileContext(profile: FinancialProfile): string {
  return `Aktuální profil uživatele (JSON):
${JSON.stringify(profile, null, 2)}`;
}

/** Extrahuje profile_update JSON z odpovědi Grok */
export function parseProfileUpdate(
  content: string
): Partial<FinancialProfile> & { readyForRecommendation?: boolean } | null {
  const match = content.match(/```profile_update\s*([\s\S]*?)```/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    const debts = (parsed.debts ?? []).map(
      (
        d: {
          creditor: string;
          amount: number;
          minimumPayment?: number;
          dueDate?: string;
          criticalDate?: string;
          criticalNote?: string;
          category: string;
          interestRate?: number;
        },
        i: number
      ) => ({
        id: `debt-${i}-${d.creditor.slice(0, 12).replace(/\s/g, "-").toLowerCase()}`,
        creditor: d.creditor,
        amount: d.amount,
        minimumPayment: d.minimumPayment,
        dueDate: d.dueDate,
        criticalDate: d.criticalDate,
        criticalNote: d.criticalNote,
        category: normalizeCategory(d.category),
        interestRate: d.interestRate,
      })
    );

    return {
      availableFunds: parsed.availableFunds ?? undefined,
      monthlyIncome: parsed.monthlyIncome,
      monthlyExpenses: parsed.monthlyExpenses,
      incomeStability: parsed.incomeStability,
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
