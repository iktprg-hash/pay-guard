"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/lib/types/financial";
import { isPaidTier } from "@/lib/types/financial";

interface ProTierBadgeProps {
  tier: SubscriptionTier;
  loading?: boolean;
  className?: string;
}

/** Displays the user's current subscription tier in Pro shell. */
export function ProTierBadge({ tier, loading, className }: ProTierBadgeProps) {
  const t = useTranslations("pro.tier");

  if (loading) {
    return (
      <div
        className={cn("h-6 w-16 animate-pulse rounded-full bg-muted", className)}
        aria-hidden
      />
    );
  }

  const paid = isPaidTier(tier);

  return (
    <Badge
      variant={paid ? "success" : "outline"}
      className={cn("gap-1 font-medium", className)}
    >
      {paid && <Sparkles className="h-3 w-3" aria-hidden />}
      {t(tier)}
    </Badge>
  );
}
