/** Pay Guard stores and calculates everything in CZK (Czech market). */

export type ForeignCurrency = "EUR" | "USD" | "GBP" | "RUB" | "UAH" | "PLN";

export const BASE_CURRENCY = "CZK" as const;

/** Approximate rates: 1 unit of foreign currency → CZK. Override via env in production. */
export const CZK_RATES: Record<ForeignCurrency, number> = {
  EUR: Number(process.env.CZK_RATE_EUR) || 25.2,
  USD: Number(process.env.CZK_RATE_USD) || 23.1,
  GBP: Number(process.env.CZK_RATE_GBP) || 29.4,
  RUB: Number(process.env.CZK_RATE_RUB) || 0.27,
  UAH: Number(process.env.CZK_RATE_UAH) || 0.58,
  PLN: Number(process.env.CZK_RATE_PLN) || 5.85,
};

const CURRENCY_ALIASES: Record<string, ForeignCurrency> = {
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  "\u20AC": "EUR",
  usd: "USD",
  dollar: "USD",
  dollars: "USD",
  $: "USD",
  gbp: "GBP",
  pound: "GBP",
  pounds: "GBP",
  "\u00A3": "GBP",
  rub: "RUB",
  ruble: "RUB",
  rubles: "RUB",
  rouble: "RUB",
  roubles: "RUB",
  rur: "RUB",
  "\u20BD": "RUB",
  uah: "UAH",
  hryvnia: "UAH",
  "\u20B4": "UAH",
  pln: "PLN",
  zloty: "PLN",
  zl: "PLN",
  "z\u0142": "PLN",
};

const CZK_TOKENS = new Set(["czk", "kc", "k\u010D", "koruna", "korun"]);

export function convertToCzk(
  amount: number,
  currency: ForeignCurrency | typeof BASE_CURRENCY
): number {
  if (currency === BASE_CURRENCY) return Math.max(0, Math.round(amount));
  const rate = CZK_RATES[currency];
  return Math.max(0, Math.round(amount * rate));
}

export function detectCurrencyToken(raw: string): ForeignCurrency | typeof BASE_CURRENCY | null {
  const token = raw.trim().toLowerCase().replace(/\./g, "");
  if (!token || CZK_TOKENS.has(token)) {
    return BASE_CURRENCY;
  }
  return CURRENCY_ALIASES[token] ?? null;
}

/** Parse "45000 RUB", "500€", "1 200 USD" → CZK amount. Returns null if no foreign currency detected. */
export function parseForeignAmountToCzk(text: string): number | null {
  const normalized = text.replace(/\u00a0/g, " ").trim();
  const match = normalized.match(
    /(\d[\d\s.,]*)\s*(\u20AC|\u00A3|\$|\u20BD|\u20B4|z\u0142|eur|usd|gbp|rub|rur|uah|pln|euro|dollar|korun[a]?|k\u010D|kc|czk)/i
  );
  if (!match) return null;

  const amount = Number.parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount)) return null;

  const currency = detectCurrencyToken(match[2]);
  if (!currency || currency === BASE_CURRENCY) return Math.round(amount);

  return convertToCzk(amount, currency);
}

/** Parse foreign amount; returns raw input number and CZK equivalent. */
export function parseForeignAmountParts(
  text: string
): { raw: number; czk: number } | null {
  const normalized = text.replace(/\u00a0/g, " ").trim();
  const match = normalized.match(
    /(\d[\d\s.,]*)\s*(\u20AC|\u00A3|\$|\u20BD|\u20B4|z\u0142|eur|usd|gbp|rub|rur|uah|pln|euro|dollar)/i
  );
  if (!match) return null;

  const raw = Number.parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(raw)) return null;

  const currency = detectCurrencyToken(match[2]);
  if (!currency || currency === BASE_CURRENCY) return null;

  return { raw: Math.round(raw), czk: convertToCzk(raw, currency) };
}

/** If profile still has pre-conversion amounts from the last message, fix them. */
export function enrichProfileFromMessage<T extends {
  availableFunds: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  debts: Array<{ amount: number; minimumPayment?: number }>;
}>(profile: T, message: string): T {
  const parts = parseForeignAmountParts(message);
  if (!parts) return profile;

  const { raw, czk } = parts;
  if (raw === czk) return profile;

  const patchAmount = (value: number) => (value === raw ? czk : value);

  return {
    ...profile,
    availableFunds: patchAmount(profile.availableFunds),
    monthlyIncome:
      profile.monthlyIncome !== undefined
        ? patchAmount(profile.monthlyIncome)
        : profile.monthlyIncome,
    monthlyExpenses:
      profile.monthlyExpenses !== undefined
        ? patchAmount(profile.monthlyExpenses)
        : profile.monthlyExpenses,
    debts: profile.debts.map((d) => ({
      ...d,
      amount: patchAmount(d.amount),
      minimumPayment:
        d.minimumPayment !== undefined ? patchAmount(d.minimumPayment) : d.minimumPayment,
    })),
  };
}

export function formatRatesForPrompt(): string {
  return Object.entries(CZK_RATES)
    .map(([code, rate]) => `1 ${code} ≈ ${rate} CZK`)
    .join(", ");
}
