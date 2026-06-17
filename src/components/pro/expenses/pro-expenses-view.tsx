"use client";

import { memo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2, TrendingDown } from "lucide-react";
import { useRecurringExpensesAnalytics } from "@/hooks/useRecurringExpensesAnalytics";
import { ExpenseFormSheet } from "@/components/pro/expenses/expense-form-sheet";
import { useCategoryDisplayLabel } from "@/components/pro/forms/pro-category-select";
import { ProEmptyState, ProPageHeader, StatCard } from "@/components/pro/pro-page";
import { ProPageSkeleton } from "@/components/pro/pro-skeletons";
import {
  ProListErrorCard,
  ProListRefreshing,
} from "@/components/pro/shared/pro-list-page-states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
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
import type { CategoryTotal } from "@/lib/pro/recurring-projection";
import { formatDate, formatMoney } from "@/lib/utils";
import {
  EXPENSE_CATEGORY_PRESETS,
  type RecurringExpense,
} from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

const CategoryBreakdown = memo(function CategoryBreakdown({
  byCategory,
  monthlyTotal,
  locale,
  categoryLabel,
}: {
  byCategory: CategoryTotal[];
  monthlyTotal: number;
  locale: Locale;
  categoryLabel: (category: string) => string;
}) {
  const t = useTranslations("pro.expenses");

  if (byCategory.length === 0) return null;

  return (
    <div className="space-y-4">
      {byCategory.map((row) => {
        const pct =
          monthlyTotal > 0
            ? Math.round((row.monthlyEquivalent / monthlyTotal) * 100)
            : 0;
        return (
          <div key={row.category} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{categoryLabel(row.category)}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatMoney(row.monthlyEquivalent, locale)}
                <span className="ml-1 text-xs">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-destructive/70"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("categoryItemCount", { count: row.itemCount })}
            </p>
          </div>
        );
      })}
    </div>
  );
});

/** Recurring expenses — categories, breakdown, CRUD. */
export function ProExpensesView() {
  const t = useTranslations("pro.expenses");
  const tForm = useTranslations("pro.forms");
  const locale = useLocale() as Locale;
  const categoryLabel = useCategoryDisplayLabel(
    "pro.expenses",
    EXPENSE_CATEGORY_PRESETS
  );
  const {
    expenses,
    monthlyTotal,
    byCategory,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    saveExpensesAsync,
    deleteExpenseAsync,
    isSaving,
    isDeleting,
  } = useRecurringExpensesAnalytics();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
    try {
      await deleteExpenseAsync(expenseId);
    } finally {
      setPendingDeleteId(null);
    }
  };

  if (isLoading && expenses.length === 0) {
    return <ProPageSkeleton variant="list" label={t("title")} />;
  }

  if (isError && expenses.length === 0) {
    return (
      <ProListErrorCard
        title={t("errorTitle")}
        description={error?.message ?? t("errorGeneric")}
        retryLabel={t("retry")}
        onRetry={() => void refetch()}
      />
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
            {t("addExpense")}
          </Button>
        }
      />

      <ProListRefreshing visible={isFetching && !isLoading} label={t("refreshingData")} />

      {isError && (
        <ProListErrorCard
          title={t("errorTitle")}
          description={error?.message ?? t("errorGeneric")}
          retryLabel={t("retry")}
          onRetry={() => void refetch()}
        />
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
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label={t("monthlyTotal")}
              value={formatMoney(monthlyTotal, locale)}
              hint={t("monthlyTotalHint")}
              trend="negative"
              icon={TrendingDown}
              iconClassName="bg-destructive/10 text-destructive"
            />
            <StatCard
              label={t("categoryCount")}
              value={String(byCategory.length)}
              hint={t("categoryCountHint")}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("categoryBreakdownTitle")}</CardTitle>
                <CardDescription>{t("categoryBreakdownDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown
                  byCategory={byCategory}
                  monthlyTotal={monthlyTotal}
                  locale={locale}
                  categoryLabel={categoryLabel}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("topCategoriesTitle")}</CardTitle>
                <CardDescription>{t("topCategoriesDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("category")}</TableHead>
                      <TableHead className="text-right">{t("monthlyEquivalent")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byCategory.slice(0, 6).map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium">
                          {categoryLabel(row.category)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          {formatMoney(row.monthlyEquivalent, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("listTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("category")}</TableHead>
                    <TableHead>{t("amount")}</TableHead>
                    <TableHead>{t("frequency")}</TableHead>
                    <TableHead>{t("nextDate")}</TableHead>
                    <TableHead className="w-[100px] text-right">
                      {tForm("actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categoryLabel(expense.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatMoney(expense.amount, locale)}
                      </TableCell>
                      <TableCell>
                        {t(`frequencies.${expense.frequency}` as "frequencies.monthly")}
                      </TableCell>
                      <TableCell>{formatDate(expense.nextDate, locale)}</TableCell>
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
                            onClick={() => setPendingDeleteId(expense.id)}
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
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <ExpenseFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        expense={editing}
        onSave={handleSave}
        saving={isSaving}
      />

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tForm("confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tForm("confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tForm("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => {
                if (pendingDeleteId) void handleDelete(pendingDeleteId);
              }}
            >
              {tForm("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
