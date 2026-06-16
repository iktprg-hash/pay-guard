"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { ProFormField, ProSelect } from "@/components/pro/forms/pro-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEBT_CATEGORIES, type Debt, type DebtCategory } from "@/lib/types/financial";

interface DebtFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt | null;
  onSave: (debt: Debt) => Promise<void>;
  saving?: boolean;
}

function emptyDebt(): Debt {
  return {
    id: crypto.randomUUID(),
    creditor: "",
    amount: 0,
    category: "other",
  };
}

/** Sheet form for adding / editing a debt. */
export function DebtFormSheet({
  open,
  onOpenChange,
  debt,
  onSave,
  saving,
}: DebtFormSheetProps) {
  const t = useTranslations("pro.debts");
  const tForm = useTranslations("pro.forms");
  const [form, setForm] = useState<Debt>(emptyDebt());

  useEffect(() => {
    if (open) {
      setForm(debt ? { ...debt } : emptyDebt());
    }
  }, [open, debt]);

  const categoryOptions = DEBT_CATEGORIES.map((cat) => ({
    value: cat,
    label: t(`categories.${cat}` as "categories.housing"),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.creditor.trim() || form.amount <= 0) return;
    await onSave({
      ...form,
      creditor: form.creditor.trim(),
      dueDate: form.dueDate || undefined,
      criticalDate: form.criticalDate || undefined,
      criticalNote: form.criticalNote?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      interestRate:
        form.interestRate != null && form.interestRate > 0
          ? form.interestRate
          : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{debt ? t("editDebt") : t("addDebt")}</SheetTitle>
          <SheetDescription>{t("formDescription")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <ProFormField label={t("creditor")} htmlFor="debt-creditor">
            <Input
              id="debt-creditor"
              value={form.creditor}
              onChange={(e) => setForm((f) => ({ ...f, creditor: e.target.value }))}
              placeholder={t("creditorPlaceholder")}
              required
            />
          </ProFormField>

          <ProFormField label={t("amount")} htmlFor="debt-amount">
            <Input
              id="debt-amount"
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

          <ProFormField label={t("category")} htmlFor="debt-category">
            <ProSelect
              id="debt-category"
              value={form.category}
              options={categoryOptions}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as DebtCategory,
                }))
              }
            />
          </ProFormField>

          <ProFormField label={t("dueDate")} htmlFor="debt-due">
            <Input
              id="debt-due"
              type="date"
              value={form.dueDate?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, dueDate: e.target.value || undefined }))
              }
            />
          </ProFormField>

          <ProFormField label={t("minimumPayment")} htmlFor="debt-min">
            <Input
              id="debt-min"
              type="number"
              min={0}
              step={1}
              value={form.minimumPayment ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  minimumPayment: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </ProFormField>

          <ProFormField label={t("criticalDate")} htmlFor="debt-critical">
            <Input
              id="debt-critical"
              type="date"
              value={form.criticalDate?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  criticalDate: e.target.value || undefined,
                }))
              }
            />
          </ProFormField>

          <ProFormField label={t("criticalNote")} htmlFor="debt-critical-note">
            <Input
              id="debt-critical-note"
              value={form.criticalNote ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, criticalNote: e.target.value }))
              }
              placeholder={t("criticalNotePlaceholder")}
            />
          </ProFormField>

          <ProFormField label={t("interestRate")} htmlFor="debt-rate">
            <Input
              id="debt-rate"
              type="number"
              min={0}
              step={0.1}
              value={form.interestRate ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  interestRate: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
              placeholder={t("interestRatePlaceholder")}
            />
          </ProFormField>

          <ProFormField label={t("notes")} htmlFor="debt-notes">
            <Textarea
              id="debt-notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t("notesPlaceholder")}
              rows={3}
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
