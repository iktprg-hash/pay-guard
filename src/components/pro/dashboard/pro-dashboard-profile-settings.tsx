"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Settings2 } from "lucide-react";
import { useSaveProProfileSettings } from "@/hooks/useProFinancial";
import { ProFormField, ProSelect } from "@/components/pro/forms/pro-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { IncomeStability } from "@/lib/types/financial";

interface ProDashboardProfileSettingsProps {
  availableFunds: number;
  incomeStability?: IncomeStability;
}

/** Editable Pro profile fields that feed Priority Engine and forecast. */
export function ProDashboardProfileSettings({
  availableFunds,
  incomeStability,
}: ProDashboardProfileSettingsProps) {
  const t = useTranslations("pro.dashboard");
  const { saveProfileSettingsAsync, isSaving } = useSaveProProfileSettings();

  const [funds, setFunds] = useState(String(availableFunds));
  const [stability, setStability] = useState<IncomeStability | "">(
    incomeStability ?? ""
  );

  useEffect(() => {
    setFunds(String(availableFunds));
    setStability(incomeStability ?? "");
  }, [availableFunds, incomeStability]);

  const stabilityOptions = [
    { value: "stable", label: t("stabilityStable") },
    { value: "variable", label: t("stabilityVariable") },
    { value: "uncertain", label: t("stabilityUncertain") },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(funds);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    await saveProfileSettingsAsync({
      availableFunds: parsed,
      incomeStability: stability || undefined,
    });
  };

  const dirty =
    Number(funds) !== availableFunds ||
    (stability || undefined) !== incomeStability;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t("profileSettingsTitle")}
        </CardTitle>
        <CardDescription>{t("profileSettingsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <ProFormField label={t("availableFunds")} htmlFor="pro-available-funds">
            <Input
              id="pro-available-funds"
              type="number"
              min={0}
              step={1}
              value={funds}
              onChange={(e) => setFunds(e.target.value)}
              required
            />
          </ProFormField>

          <ProFormField label={t("incomeStability")} htmlFor="pro-stability">
            <ProSelect
              id="pro-stability"
              value={stability}
              options={[{ value: "", label: t("stabilityUnset") }, ...stabilityOptions]}
              onChange={(e) =>
                setStability(e.target.value as IncomeStability | "")
              }
            />
          </ProFormField>

          <Button type="submit" size="sm" disabled={isSaving || !dirty}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? t("savingProfileSettings") : t("saveProfileSettings")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
