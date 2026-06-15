"use client";

import { Cloud, CloudOff, Loader2, Check, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProSyncStatus } from "@/hooks/use-chat-with-pro";

interface ProSyncBarProps {
  isProEnabled: boolean;
  isProLoading: boolean;
  isOnline: boolean;
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
  isOnline,
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
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={t("loading")}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {t("loading")}
      </div>
    );
  }

  const controlsDisabled = isSyncing || !isOnline;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="region"
      aria-label={t("syncRegion")}
      aria-live="polite"
    >
      <ProSyncBadge
        syncStatus={syncStatus}
        isSyncing={isSyncing}
        isOnline={isOnline}
      />

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={onLoadFromPro}
        disabled={controlsDisabled}
        aria-disabled={controlsDisabled}
        aria-label={t("loadFromPro")}
        title={!isOnline ? t("offlineHint") : undefined}
      >
        <Cloud className="h-3.5 w-3.5" aria-hidden />
        {t("loadFromPro")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={onSaveToPro}
        disabled={controlsDisabled}
        aria-disabled={controlsDisabled}
        aria-label={t("saveToPro")}
        title={!isOnline ? t("offlineHint") : undefined}
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
  isOnline,
}: {
  syncStatus: ProSyncStatus;
  isSyncing: boolean;
  isOnline: boolean;
}) {
  const t = useTranslations("chat.pro");

  if (!isOnline) {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <WifiOff className="h-3 w-3" aria-hidden />
        {t("offline")}
      </Badge>
    );
  }

  if (isSyncing || syncStatus === "syncing") {
    return (
      <Badge variant="secondary" className="gap-1 font-normal" aria-busy="true">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {t("syncing")}
      </Badge>
    );
  }

  if (syncStatus === "synced") {
    return (
      <Badge variant="success" className="gap-1 font-normal">
        <Check className="h-3 w-3" aria-hidden />
        {t("synced")}
      </Badge>
    );
  }

  if (syncStatus === "failed") {
    return (
      <Badge variant="warning" className="gap-1 font-normal">
        <CloudOff className="h-3 w-3" aria-hidden />
        {t("syncFailed")}
      </Badge>
    );
  }

  return null;
}
