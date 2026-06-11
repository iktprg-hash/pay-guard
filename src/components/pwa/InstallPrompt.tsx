"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/components/pwa/PwaInstallProvider";
import {
  dismissInstallPrompt,
  getRecommendationCount,
  markInstallBannerShown,
  wasInstallBannerShown,
  wasInstallPromptDismissed,
} from "@/lib/offline/storage";
import { INSTALL_PROMPT_AFTER_RECOMMENDATIONS } from "@/lib/pwa/config";

/**
 * Odložený install banner — po N úspěšných doporučeních.
 * Respektuje dismiss a stav „už nainstalováno“.
 */
export function InstallPromptBanner() {
  const t = useTranslations("pwa.install");
  const { canInstall, isInstalled, isIOS, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      if (isInstalled) return;
      if (isIOS) return; // iOS nemá beforeinstallprompt — instrukce v Settings

      const [count, dismissed, shown] = await Promise.all([
        getRecommendationCount(),
        wasInstallPromptDismissed(),
        wasInstallBannerShown(),
      ]);

      if (cancelled || dismissed) return;
      if (count >= INSTALL_PROMPT_AFTER_RECOMMENDATIONS && canInstall && !shown) {
        setVisible(true);
        await markInstallBannerShown();
      }
    }

    evaluate();
    return () => {
      cancelled = true;
    };
  }, [canInstall, isInstalled, isIOS]);

  const handleInstall = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") setVisible(false);
  }, [promptInstall]);

  const handleDismiss = useCallback(async () => {
    await dismissInstallPrompt();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-lg animate-in slide-in-from-bottom-4 rounded-2xl border bg-card p-4 shadow-lg">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t("bannerTitle")}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("bannerBody")}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleInstall}>
              {t("install")}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              {t("later")}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={t("dismiss")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Tlačítko instalace pro header / settings */
export function InstallAppButton({
  variant = "outline",
  size = "sm",
  className,
}: {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}) {
  const t = useTranslations("pwa.install");
  const { canInstall, isInstalled, isIOS, promptInstall } = usePwaInstall();

  if (isInstalled) {
    return (
      <span className="text-xs text-muted-foreground">{t("installed")}</span>
    );
  }

  if (isIOS) {
    return (
      <span className="text-xs text-muted-foreground" title={t("iosHint")}>
        {t("iosShort")}
      </span>
    );
  }

  if (!canInstall) return null;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => promptInstall()}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      {t("install")}
    </Button>
  );
}

/** Re-export pro sledování počtu doporučení zvenku */
export { getRecommendationCount };
