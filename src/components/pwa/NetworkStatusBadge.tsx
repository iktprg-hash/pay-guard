"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNetworkStatus } from "@/components/pwa/NetworkProvider";
import { cn } from "@/lib/utils";

/** Network status pill for header */
export function NetworkStatusBadge({ className }: { className?: string }) {
  const t = useTranslations("pwa.settings");
  const { isOnline } = useNetworkStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isOnline
          ? "bg-green-500/10 text-green-700 dark:text-green-400"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        className
      )}
      title={isOnline ? t("online") : t("offline")}
    >
      {isOnline ? (
        <Wifi className="h-3 w-3" aria-hidden />
      ) : (
        <WifiOff className="h-3 w-3" aria-hidden />
      )}
      <span className="hidden sm:inline">
        {isOnline ? t("online") : t("offline")}
      </span>
    </span>
  );
}
