"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { ProCategorySelect } from "@/components/pro/forms/pro-category-select";
import { ProFormField, ProSelect } from "@/components/pro/forms/pro-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FREQUENCIES,
  INCOME_CATEGORY_PRESETS,
  type Frequency,
  type RecurringIncome,
} from "@/lib/types/financial";

interface IncomeFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income?: RecurringIncome | null;
  onSave: (income: RecurringIncome) => Promise<void>;
  saving?: boolean;
}

function emptyIncome(): RecurringIncome {
  return {
    id: crypto.randomUUID(),
    source: "",
    amount: 0,
    frequency: "monthly",
    category: "salary",
    nextDate: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
}

/** Sheet form for adding / editing recurring income. */
export function IncomeFormSheet({
  open,
  onOpenChange,
  income,
  onSave,
  saving,
}: IncomeFormSheetProps) {
  const t = useTranslations("pro.incomes");
  const tForm = useTranslations("pro.forms");
  const [form, setForm] = useState<RecurringIncome>(emptyIncome());

  useEffect(() => {
    if (open) {
      setForm(
        income
          ? { ...income, category: income.category ?? "other" }
          : emptyIncome()
      );
    }
  }, [open, income]);

  const frequencyOptions = FREQUENCIES.map((f) => ({
    value: f,
    label: t(`frequencies.${f}` as "frequencies.monthly"),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.source.trim() || form.amount <= 0 || !form.nextDate || !form.category) {
      return;
    }
    await onSave({
      ...form,
      source: form.source.trim(),
      category: form.category.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{income ? t("editIncome") : t("addIncome")}</SheetTitle>
          <SheetDescription>{t("formDescription")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <ProFormField label={t("source")} htmlFor="income-source">
            <Input
              id="income-source"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              placeholder={t("sourcePlaceholder")}
              required
            />
          </ProFormField>

          <ProCategorySelect
            id="income-category"
            label={t("category")}
            value={form.category}
            onChange={(category) => setForm((f) => ({ ...f, category }))}
            presets={INCOME_CATEGORY_PRESETS}
            translationNamespace="pro.incomes"
          />

          <ProFormField label={t("amount")} htmlFor="income-amount">
            <Input
              id="income-amount"
              type="number"
              min={1}
              step={1}
              value={form.amount || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))
              }
              required
            />
          </ProFormField>

          <ProFormField label={t("frequency")} htmlFor="income-frequency">
            <ProSelect
              id="income-frequency"
              value={form.frequency}
              options={frequencyOptions}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  frequency: e.target.value as Frequency,
                }))
              }
            />
          </ProFormField>

          <ProFormField label={t("nextDate")} htmlFor="income-next">
            <Input
              id="income-next"
              type="date"
              value={form.nextDate.slice(0, 10)}
              onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))}
              required
            />
          </ProFormField>

          <SheetFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {tForm("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tForm("save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
