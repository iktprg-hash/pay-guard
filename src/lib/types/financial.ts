/** Kategorie dluhu — ovlivňuje váhu v algoritmu */
export type DebtCategory =
  | "housing"      // nájem, hypotéka
  | "utilities"    // energie, voda, plyn
  | "taxes"        // daně, odvody
  | "fines"        // pokuty, exekuce
  | "loans"        // půjčky, úvěry
  | "credit_card"  // kreditní karty
  | "medical"      // zdravotní výlohy
  | "other";

/** Stabilita příjmu */
export type IncomeStability = "stable" | "variable" | "uncertain";

/**
 * Úroveň priority plateb (Priority Engine)
 * 0 = Kritický, 1 = Vysoký, 2 = Střední, 3 = Nízký
 */
export type PriorityLevel = 0 | 1 | 2 | 3;

/** Jeden dluh / závazek */
export interface Debt {
  id: string;
  creditor: string;
  amount: number;
  minimumPayment?: number;
  dueDate?: string;
  criticalDate?: string;
  criticalNote?: string;
  category: DebtCategory;
  interestRate?: number;
  notes?: string;
}

/** Finanční profil uživatele */
export interface FinancialProfile {
  availableFunds: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  incomeStability?: IncomeStability;
  debts: Debt[];
}

/** Doporučená platba */
export interface PaymentRecommendation {
  debtId: string;
  creditor: string;
  recommendedAmount: number;
  /** Číselné skóre naléhavosti (vyšší = důležitější) */
  priority: number;
  /** Úroveň 0–3 pro UI a logiku */
  priorityLevel: PriorityLevel;
  reason: string;
  /** Podrobné vysvětlení rozhodnutí */
  explanation: string;
  category: DebtCategory;
}

/** Výsledek algoritmu prioritizace */
export interface PrioritizationResult {
  recommendations: PaymentRecommendation[];
  totalAllocated: number;
  remainingFunds: number;
  /** Rezerva na životní náklady (jídlo, doprava…) */
  lifeBuffer: number;
  /** Procento rezervy (0.20–0.35) */
  lifeBufferPercent: number;
  /** Prostředky určené k rozdělení mezi věřitele */
  spendableFunds: number;
  summary: string;
  warnings: string[];
}

/** Zpráva v chatu */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  recommendation?: PrioritizationResult;
}

/** Úroveň předplatného */
export type SubscriptionTier = "free" | "pro";
