"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { useProAccess } from "@/hooks/use-pro-access";

export function FreePlanBadge() {
  const t = useTranslations("pricing");
  const { isProEnabled: pro, loading } = useProAccess();

  if (loading || pro) return null;

  return (
    <Badge className="mt-6" variant="secondary">
      {t("currentPlan")}
    </Badge>
  );
}
