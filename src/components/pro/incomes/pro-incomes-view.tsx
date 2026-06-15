"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { useRecurringIncomes } from "@/hooks/useProFinancial";
import { IncomeFormSheet } from "@/components/pro/incomes/income-form-sheet";
import { ProEmptyState, ProPageHeader } from "@/components/pro/pro-page";
import { ListTableSkeleton } from "@/components/pro/pro-skeletons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/utils";
import type { RecurringIncome } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

/** Recurring incomes — list, add/edit sheet, delete. */
export function ProIncomesView() {
  const t = useTranslations("pro.incomes");
  const tForm = useTranslations("pro.forms");
  const locale = useLocale() as Locale;
  const {
    incomes,
    isLoading,
    error,
    saveIncomesAsync,
    deleteIncomeAsync,
    isSaving,
    isDeleting,
  } = useRecurringIncomes();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringIncome | null>(null);

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (income: RecurringIncome) => {
    setEditing(income);
    setSheetOpen(true);
  };

  const handleSave = async (income: RecurringIncome) => {
    const exists = incomes.some((i) => i.id === income.id);
    const next = exists
      ? incomes.map((i) => (i.id === income.id ? income : i))
      : [...incomes, income];
    await saveIncomesAsync(next);
  };

  const handleDelete = async (incomeId: string) => {
    if (!window.confirm(tForm("confirmDelete"))) return;
    await deleteIncomeAsync(incomeId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <ListTableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProPageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button onClick={openCreate} disabled={isSaving}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addIncome")}
          </Button>
        }
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}

      {incomes.length === 0 ? (
        <ProEmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addIncome")}
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("listTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("source")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("frequency")}</TableHead>
                  <TableHead>{t("nextDate")}</TableHead>
                  <TableHead className="w-[100px] text-right">
                    {tForm("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomes.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell className="font-medium">{income.source}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(income.amount, locale)}
                    </TableCell>
                    <TableCell>
                      {t(`frequencies.${income.frequency}` as "frequencies.monthly")}
                    </TableCell>
                    <TableCell>{formatDate(income.nextDate, locale)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(income)}
                          aria-label={tForm("edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => void handleDelete(income.id)}
                          disabled={isDeleting}
                          aria-label={tForm("delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <IncomeFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        income={editing}
        onSave={handleSave}
        saving={isSaving}
      />
    </div>
  );
}
