import { z } from "zod";
import { DEBT_CATEGORIES } from "@/lib/types/financial";

const debtCategoryEnum = z.enum(DEBT_CATEGORIES);

const INCOME_STABILITY = ["stable", "variable", "uncertain"] as const;

const LOCALES = ["cs", "ru", "en"] as const;

export const debtSchema = z.object({
  id: z.string().max(100).optional(),
  creditor: z.string().min(1).max(200),
  amount: z.number().min(0).max(100_000_000),
  minimumPayment: z.number().min(0).max(100_000_000).optional(),
  dueDate: z.string().max(30).optional(),
  criticalDate: z.string().max(30).optional(),
  criticalNote: z.string().max(500).optional(),
  category: debtCategoryEnum.default("other"),
  interestRate: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const financialProfileSchema = z.object({
  availableFunds: z.number().min(0).max(100_000_000),
  monthlyIncome: z.number().min(0).max(100_000_000).optional(),
  monthlyExpenses: z.number().min(0).max(100_000_000).optional(),
  incomeStability: z.enum(INCOME_STABILITY).optional(),
  debts: z.array(debtSchema).max(50),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(10_000),
});

export const sessionIdSchema = z.string().uuid();
export const sessionTokenSchema = z.string().min(32).max(128);

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(100),
  profile: financialProfileSchema,
  locale: z.enum(LOCALES).default("cs"),
  sessionId: sessionIdSchema.optional(),
  sessionToken: sessionTokenSchema.optional(),
});

export const prioritizeRequestSchema = z.object({
  profile: financialProfileSchema,
  locale: z.enum(LOCALES).default("cs"),
});

export const storedMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(10_000),
  timestamp: z.string(),
  recommendation: z.unknown().optional(),
});

export const historyPostSchema = z.object({
  sessionId: sessionIdSchema,
  sessionToken: sessionTokenSchema.optional(),
  locale: z.enum(LOCALES),
  messages: z.array(storedMessageSchema).max(200),
  profile: financialProfileSchema,
});

export const historyGetSchema = z.object({
  sessionId: sessionIdSchema,
});

/** Grok profile_update block — validated before merge */
export const grokDebtUpdateSchema = z.object({
  creditor: z.string().min(1).max(200),
  amount: z.number().min(0).max(100_000_000),
  minimumPayment: z.number().min(0).max(100_000_000).nullish(),
  dueDate: z.string().max(30).nullish(),
  criticalDate: z.string().max(30).nullish(),
  criticalNote: z.string().max(500).nullish(),
  category: debtCategoryEnum.optional().default("other"),
  interestRate: z.number().min(0).max(100).nullish(),
});

export const grokProfileUpdateSchema = z.object({
  availableFunds: z.number().min(0).max(100_000_000).nullish(),
  monthlyIncome: z.number().min(0).max(100_000_000).nullish(),
  monthlyExpenses: z.number().min(0).max(100_000_000).nullish(),
  incomeStability: z.enum(INCOME_STABILITY).nullish(),
  debts: z.array(grokDebtUpdateSchema).max(50).optional(),
  readyForRecommendation: z.boolean().optional(),
  analysisMode: z.enum(["quick", "full"]).nullish(),
});

export type GrokProfileUpdate = z.infer<typeof grokProfileUpdateSchema>;

/** Normalizuje profil — doplní id u dluhů */
export function normalizeProfile(
  profile: z.infer<typeof financialProfileSchema>
) {
  return {
    ...profile,
    debts: profile.debts.map((d, i) => ({
      ...d,
      id:
        d.id ??
        `debt-${i}-${d.creditor.slice(0, 12).replace(/\s/g, "-").toLowerCase()}`,
    })),
  };
}
