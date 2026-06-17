"use client";

import { memo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarRange, Pencil, Plus, Trash2, TrendingUp, Wallet } from "lucide-react";
import { useRecurringIncomesAnalytics } from "@/hooks/useRecurringIncomesAnalytics";
import { IncomeFormSheet } from "@/components/pro/incomes/income-form-sheet";
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
import type { MonthCashProjection } from "@/lib/pro/recurring-projection";
import { formatForecastMonth } from "@/lib/pro/format-forecast-month";
import { formatDate, formatMoney } from "@/lib/utils";
import { INCOME_CATEGORY_PRESETS, type RecurringIncome } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

const IncomeProjectionChart = memo(function IncomeProjectionChart({
  projection,
  locale,
}: {
  projection: MonthCashProjection[];
  locale: Locale;
}) {
  const t = useTranslations("pro.incomes");
  const max = Math.max(...projection.map((m) => m.total), 1);

  return (
    <div
      className="flex h-40 items-end justify-around gap-3 rounded-xl border bg-muted/20 px-4 pb-4 pt-6"
      role="img"
      aria-label={t("projectionTitle")}
    >
      {projection.map((month) => {
        const heightPct = Math.max(8, (month.total / max) * 100);
        return (
          <div
            key={month.yearMonth}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(month.total, locale)}
            </span>
            <div className="flex h-24 w-full items-end justify-center">
              <div
                className="w-full max-w-14 rounded-t-md bg-emerald-500/80"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="truncate text-center text-xs text-muted-foreground">
              {formatForecastMonth(month.yearMonth, locale)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

/** Recurring incomes — categories, 3-month projection, CRUD. */
export function ProIncomesView() {
  const t = useTranslations("pro.incomes");
  const tForm = useTranslations("pro.forms");
  const locale = useLocale() as Locale;
  const categoryLabel = useCategoryDisplayLabel("pro.incomes", INCOME_CATEGORY_PRESETS);
  const {
    incomes,
    monthlyTotal,
    projection,
    projectionTotal,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    saveIncomesAsync,
    deleteIncomeAsync,
    isSaving,
    isDeleting,
  } = useRecurringIncomesAnalytics();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringIncome | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
    await deleteIncomeAsync(incomeId);
    setPendingDeleteId(null);
  };

  if (isLoading && incomes.length === 0) {
    return <ProPageSkeleton variant="list" label={t("title")} />;
  }

  if (isError && incomes.length === 0) {
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
            {t("addIncome")}
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
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={t("monthlyTotal")}
              value={formatMoney(monthlyTotal, locale)}
              hint={t("monthlyTotalHint")}
              trend="positive"
              icon={Wallet}
              iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label={t("sourceCount")}
              value={String(incomes.length)}
              hint={t("sourceCountHint")}
              icon={TrendingUp}
            />
            <StatCard
              label={t("projectionTotal")}
              value={formatMoney(projectionTotal, locale)}
              hint={t("projectionTotalHint")}
              trend="positive"
              icon={CalendarRange}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("projectionTitle")}</CardTitle>
              <CardDescription>{t("projectionDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeProjectionChart projection={projection} locale={locale} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("listTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("source")}</TableHead>
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
                  {incomes.map((income) => (
                    <TableRow key={income.id}>
                      <TableCell className="font-medium">{income.source}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categoryLabel(income.category ?? "other")}
                        </Badge>
                      </TableCell>
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
                            onClick={() => setPendingDeleteId(income.id)}
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

      <IncomeFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        income={editing}
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
