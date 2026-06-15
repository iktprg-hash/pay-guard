"use client";

import { Cloud, CloudOff, Loader2, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProSyncStatus } from "@/hooks/use-chat-with-pro";

interface ProSyncBarProps {
  isProEnabled: boolean;
  isProLoading: boolean;
  syncStatus: ProSyncStatus;
  isSyncing: boolean;
  onLoadFromPro: () => void;
  onSaveToPro: () => void;
  className?: string;
}

/** Pro cloud sync controls + status indicator for the chat toolbar. */
export function ProSyncBar({
  isProEnabled,
  isProLoading,
  syncStatus,
  isSyncing,
  onLoadFromPro,
  onSaveToPro,
  className,
}: ProSyncBarProps) {
  const t = useTranslations("chat.pro");

  if (!isProEnabled && !isProLoading) return null;

  if (isProLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          className
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {t("loading")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        className
      )}
    >
      <ProSyncBadge syncStatus={syncStatus} isSyncing={isSyncing} />

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={onLoadFromPro}
        disabled={isSyncing}
      >
        <Cloud className="h-3.5 w-3.5" aria-hidden />
        {t("loadFromPro")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={onSaveToPro}
        disabled={isSyncing}
      >
        <Cloud className="h-3.5 w-3.5" aria-hidden />
        {t("saveToPro")}
      </Button>
    </div>
  );
}

function ProSyncBadge({
  syncStatus,
  isSyncing,
}: {
  syncStatus: ProSyncStatus;
  isSyncing: boolean;
}) {
  const t = useTranslations("chat.pro");

  if (isSyncing) {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {t("syncing")}
      </Badge>
    );
  }

  if (syncStatus === "saved") {
    return (
      <Badge variant="success" className="gap-1 font-normal">
        <Check className="h-3 w-3" aria-hidden />
        {t("savedToCloud")}
      </Badge>
    );
  }

  if (syncStatus === "error") {
    return (
      <Badge variant="warning" className="gap-1 font-normal">
        <CloudOff className="h-3 w-3" aria-hidden />
        {t("syncFailed")}
      </Badge>
    );
  }

  return null;
}
