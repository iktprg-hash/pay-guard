import { z } from "zod";

export const DebtSchema = z.object({
  id: z.string().optional(),
  category: z.enum(["housing","utilities","taxes","fines","medical","transport","food","subscriptions","loans","credit_card","other"]),
  amount: z.number().min(0),
  minimumPayment: z.number().min(0).optional(),
  interestRate: z.number().min(0).max(1000).optional(),
  dueDate: z.string().datetime().optional(),
  name: z.string().optional(),
  notes: z.string().optional(),
});

export const FinancialProfileSchema = z.object({
  availableFunds: z.number().min(0),
  monthlyIncome: z.number().min(0).optional(),
  monthlyExpenses: z.number().min(0).optional(),
  debts: z.array(DebtSchema),
  recurringIncomes: z.array(z.any()).optional(),
  recurringExpenses: z.array(z.any()).optional(),
});

export type ValidatedFinancialProfile = z.infer<typeof FinancialProfileSchema>;
