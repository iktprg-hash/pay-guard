"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";

export function FreePlanBadge() {
  const t = useTranslations("pricing");
  const { pro, loading } = useSubscriptionTier();

  if (loading || pro) return null;

  return (
    <Badge className="mt-6" variant="secondary">
      {t("currentPlan")}
    </Badge>
  );
}
