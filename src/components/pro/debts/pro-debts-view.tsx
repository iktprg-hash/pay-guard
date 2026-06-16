"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useDebts } from "@/hooks/useProFinancial";
import { DebtFormSheet } from "@/components/pro/debts/debt-form-sheet";
import { ProEmptyState, ProPageHeader } from "@/components/pro/pro-page";
import { ProPageSkeleton } from "@/components/pro/pro-skeletons";
import {
  ProListErrorCard,
  ProListRefreshing,
} from "@/components/pro/shared/pro-list-page-states";
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
import type { Debt } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

/** Debts management — list, add/edit sheet, delete. */
export function ProDebtsView() {
  const t = useTranslations("pro.debts");
  const tForm = useTranslations("pro.forms");
  const locale = useLocale() as Locale;
  const {
    debts,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    saveDebtsAsync,
    deleteDebtAsync,
    isSaving,
    isDeleting,
  } = useDebts();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (debt: Debt) => {
    setEditing(debt);
    setSheetOpen(true);
  };

  const handleSave = async (debt: Debt) => {
    const exists = debts.some((d) => d.id === debt.id);
    const next = exists
      ? debts.map((d) => (d.id === debt.id ? debt : d))
      : [...debts, debt];
    await saveDebtsAsync(next);
  };

  const handleDelete = async (debtId: string) => {
    if (!window.confirm(tForm("confirmDelete"))) return;
    await deleteDebtAsync(debtId);
  };

  if (isLoading && debts.length === 0) {
    return <ProPageSkeleton variant="list" label={t("title")} />;
  }

  if (isError && debts.length === 0) {
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
            {t("addDebt")}
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

      {debts.length === 0 ? (
        <ProEmptyState
          icon={<Wallet className="h-6 w-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addDebt")}
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
                  <TableHead>{t("creditor")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("dueDate")}</TableHead>
                  <TableHead className="w-[100px] text-right">
                    {tForm("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((debt) => (
                  <TableRow key={debt.id}>
                    <TableCell className="font-medium">{debt.creditor}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(debt.amount, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(`categories.${debt.category}` as "categories.housing")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {debt.dueDate ? formatDate(debt.dueDate, locale) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(debt)}
                          aria-label={tForm("edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => void handleDelete(debt.id)}
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

      <DebtFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        debt={editing}
        onSave={handleSave}
        saving={isSaving}
      />
    </div>
  );
}
