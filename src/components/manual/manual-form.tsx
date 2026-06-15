"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationCard } from "@/components/chat/recommendation-card";
import { OfflineRecommendationCard } from "@/components/pwa/OfflineRecommendationCard";
import { Spinner } from "@/components/ui/page-loader";
import { persistRecommendationOffline } from "@/lib/pwa/persistRecommendation";
import { runPriorityEngine } from "@/services/priorityEngine";
import type { Debt, DebtCategory, FinancialProfile, PrioritizationResult } from "@/lib/types/financial";
import { DEBT_CATEGORIES } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

const CATEGORIES: DebtCategory[] = [...DEBT_CATEGORIES];

function emptyDebt(): Debt {
  return {
    id: `debt-${Date.now()}`,
    creditor: "",
    amount: 0,
    category: "other",
  };
}

export function ManualForm() {
  const t = useTranslations("manual");
  const tCat = useTranslations("categories");
  const locale = useLocale() as Locale;

  const [profile, setProfile] = useState<FinancialProfile>({
    availableFunds: 0,
    debts: [emptyDebt()],
  });
  const [result, setResult] = useState<PrioritizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDebt = (id: string, field: keyof Debt, value: string | number) => {
    setProfile((prev) => ({
      ...prev,
      debts: prev.debts.map((d) =>
        d.id === id ? { ...d, [field]: value } : d
      ),
    }));
  };

  const addDebt = () => {
    setProfile((prev) => ({
      ...prev,
      debts: [...prev.debts, emptyDebt()],
    }));
  };

  const removeDebt = (id: string) => {
    setProfile((prev) => ({
      ...prev,
      debts: prev.debts.filter((d) => d.id !== id),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let data: PrioritizationResult;

      if (!navigator.onLine) {
        data = runPriorityEngine(profile, locale);
      } else {
        const res = await fetch("/api/prioritize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ profile, locale }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? t("error"));
          return;
        }
        data = json;
      }

      await persistRecommendationOffline(locale, profile, data, "manual");
      setResult(data);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <OfflineRecommendationCard locale={locale} />
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="funds">{t("availableFunds")}</Label>
              <Input
                id="funds"
                type="number"
                min={0}
                value={profile.availableFunds || ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    availableFunds: Number(e.target.value),
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="income">{t("monthlyIncome")}</Label>
              <Input
                id="income"
                type="number"
                min={0}
                value={profile.monthlyIncome ?? ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    monthlyIncome: Number(e.target.value) || undefined,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("incomeStability")}</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={profile.incomeStability ?? ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  incomeStability: e.target.value as FinancialProfile["incomeStability"],
                }))
              }
            >
              <option value="">—</option>
              <option value="stable">{t("stable")}</option>
              <option value="variable">{t("variable")}</option>
              <option value="uncertain">{t("uncertain")}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("debts")}</h2>
          <Button type="button" variant="outline" size="sm" onClick={addDebt}>
            <Plus className="mr-1 h-4 w-4" />
            {t("addDebt")}
          </Button>
        </div>

        {profile.debts.map((debt) => (
          <Card key={debt.id}>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("creditor")}</Label>
                  <Input
                    value={debt.creditor}
                    onChange={(e) => updateDebt(debt.id, "creditor", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("amount")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={debt.amount || ""}
                    onChange={(e) => updateDebt(debt.id, "amount", Number(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("minimumPayment")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={debt.minimumPayment ?? ""}
                    onChange={(e) =>
                      updateDebt(debt.id, "minimumPayment", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("category")}</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    value={debt.category}
                    onChange={(e) =>
                      updateDebt(debt.id, "category", e.target.value as DebtCategory)
                    }
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {tCat(cat)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t("dueDate")}</Label>
                  <Input
                    type="date"
                    value={debt.dueDate ?? ""}
                    onChange={(e) => updateDebt(debt.id, "dueDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("criticalDate")}</Label>
                  <Input
                    type="date"
                    value={debt.criticalDate ?? ""}
                    onChange={(e) => updateDebt(debt.id, "criticalDate", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("criticalNote")}</Label>
                <Input
                  value={debt.criticalNote ?? ""}
                  onChange={(e) => updateDebt(debt.id, "criticalNote", e.target.value)}
                  placeholder={t("criticalNotePlaceholder")}
                />
              </div>
              {profile.debts.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removeDebt(debt.id)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {t("remove")}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <Spinner label={t("calculating")} /> : t("submit")}
      </Button>

      {error && (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {result && (
        <RecommendationCard result={result} />
      )}
    </form>
  );
}
