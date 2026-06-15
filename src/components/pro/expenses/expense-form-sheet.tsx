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
  EXPENSE_CATEGORY_PRESETS,
  FREQUENCIES,
  type Frequency,
  type RecurringExpense,
} from "@/lib/types/financial";

interface ExpenseFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: RecurringExpense | null;
  onSave: (expense: RecurringExpense) => Promise<void>;
  saving?: boolean;
}

function emptyExpense(): RecurringExpense {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: 0,
    frequency: "monthly",
    category: "housing",
    nextDate: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
}

/** Sheet form for adding / editing recurring expense. */
export function ExpenseFormSheet({
  open,
  onOpenChange,
  expense,
  onSave,
  saving,
}: ExpenseFormSheetProps) {
  const t = useTranslations("pro.expenses");
  const tForm = useTranslations("pro.forms");
  const [form, setForm] = useState<RecurringExpense>(emptyExpense());

  useEffect(() => {
    if (open) {
      setForm(
        expense
          ? { ...expense, category: expense.category ?? "other" }
          : emptyExpense()
      );
    }
  }, [open, expense]);

  const frequencyOptions = FREQUENCIES.map((f) => ({
    value: f,
    label: t(`frequencies.${f}` as "frequencies.monthly"),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.amount <= 0 || !form.nextDate || !form.category) {
      return;
    }
    await onSave({
      ...form,
      name: form.name.trim(),
      category: form.category.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{expense ? t("editExpense") : t("addExpense")}</SheetTitle>
          <SheetDescription>{t("formDescription")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <ProFormField label={t("name")} htmlFor="expense-name">
            <Input
              id="expense-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("namePlaceholder")}
              required
            />
          </ProFormField>

          <ProCategorySelect
            id="expense-category"
            label={t("category")}
            value={form.category}
            onChange={(category) => setForm((f) => ({ ...f, category }))}
            presets={EXPENSE_CATEGORY_PRESETS}
            translationNamespace="pro.expenses"
          />

          <ProFormField label={t("amount")} htmlFor="expense-amount">
            <Input
              id="expense-amount"
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

          <ProFormField label={t("frequency")} htmlFor="expense-frequency">
            <ProSelect
              id="expense-frequency"
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

          <ProFormField label={t("nextDate")} htmlFor="expense-next">
            <Input
              id="expense-next"
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
