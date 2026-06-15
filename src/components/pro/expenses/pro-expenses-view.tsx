"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2, TrendingDown } from "lucide-react";
import { useRecurringExpenses } from "@/hooks/useProFinancial";
import { ExpenseFormSheet } from "@/components/pro/expenses/expense-form-sheet";
import { ProEmptyState, ProPageHeader } from "@/components/pro/pro-page";
import { ProListPageSkeleton } from "@/components/pro/pro-skeletons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { RecurringExpense } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

/** Recurring expenses — list, add/edit sheet, delete. */
export function ProExpensesView() {
  const t = useTranslations("pro.expenses");
  const tForm = useTranslations("pro.forms");
  const locale = useLocale() as Locale;
  const {
    expenses,
    isLoading,
    error,
    saveExpensesAsync,
    deleteExpenseAsync,
    isSaving,
    isDeleting,
  } = useRecurringExpenses();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (expense: RecurringExpense) => {
    setEditing(expense);
    setSheetOpen(true);
  };

  const handleSave = async (expense: RecurringExpense) => {
    const exists = expenses.some((e) => e.id === expense.id);
    const next = exists
      ? expenses.map((e) => (e.id === expense.id ? expense : e))
      : [...expenses, expense];
    await saveExpensesAsync(next);
  };

  const handleDelete = async (expenseId: string) => {
    if (!window.confirm(tForm("confirmDelete"))) return;
    await deleteExpenseAsync(expenseId);
  };

  if (isLoading) {
    return <ProListPageSkeleton label={t("title")} />;
  }

  return (
    <div className="space-y-6">
      <ProPageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button onClick={openCreate} disabled={isSaving}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addExpense")}
          </Button>
        }
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}

      {expenses.length === 0 ? (
        <ProEmptyState
          icon={<TrendingDown className="h-6 w-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addExpense")}
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
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("frequency")}</TableHead>
                  <TableHead className="w-[100px] text-right">
                    {tForm("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.name}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(expense.amount, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(`categories.${expense.category}` as "categories.housing")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t(`frequencies.${expense.frequency}` as "frequencies.monthly")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(expense)}
                          aria-label={tForm("edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => void handleDelete(expense.id)}
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

      <ExpenseFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        expense={editing}
        onSave={handleSave}
        saving={isSaving}
      />
    </div>
  );
}
