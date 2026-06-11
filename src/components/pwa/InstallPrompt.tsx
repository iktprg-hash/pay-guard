"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IOSInstallSheet } from "@/components/pwa/IOSInstallSheet";
import { usePwaInstall } from "@/components/pwa/PwaInstallProvider";
import {
  dismissInstallPrompt,
  getRecommendationCount,
  markInstallBannerShown,
  wasInstallBannerShown,
  wasInstallPromptDismissed,
} from "@/lib/offline/storage";
import { INSTALL_PROMPT_AFTER_RECOMMENDATIONS } from "@/lib/pwa/config";
import { onRecommendationSaved } from "@/lib/pwa/events";

async function shouldShowInstallBanner(isIOS: boolean, canInstall: boolean) {
  if (await wasInstallPromptDismissed()) return false;
  if (await wasInstallBannerShown()) return false;

  const count = await getRecommendationCount();
  if (count < INSTALL_PROMPT_AFTER_RECOMMENDATIONS) return false;

  // Android/Desktop: need deferred prompt; iOS: always show after threshold
  if (!isIOS && !canInstall) return false;
  return true;
}

/**
 * Deferred install banner — after N successful recommendations.
 * Android: native install. iOS: opens step-by-step sheet.
 */
export function InstallPromptBanner() {
  const t = useTranslations("pwa.install");
  const { canInstall, isInstalled, isIOS, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);

  const evaluate = useCallback(async () => {
    if (isInstalled) {
      setVisible(false);
      return;
    }
    const show = await shouldShowInstallBanner(isIOS, canInstall);
    if (show) {
      setVisible(true);
      await markInstallBannerShown();
    }
  }, [canInstall, isInstalled, isIOS]);

  useEffect(() => {
    void evaluate();
    return onRecommendationSaved(() => {
      void evaluate();
    });
  }, [evaluate]);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      setIosSheetOpen(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === "accepted") setVisible(false);
  }, [isIOS, promptInstall]);

  const handleDismiss = useCallback(async () => {
    await dismissInstallPrompt();
    setVisible(false);
  }, []);

  if (!visible && !iosSheetOpen) return null;

  return (
    <>
      {visible && (
        <div className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-lg animate-in slide-in-from-bottom-4 rounded-2xl border bg-card p-4 shadow-lg">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              {isIOS ? (
                <Share className="h-5 w-5 text-primary" />
              ) : (
                <Download className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t("bannerTitle")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isIOS ? t("iosBannerBody") : t("bannerBody")}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handleInstall}>
                  {isIOS ? t("iosShort") : t("install")}
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
      )}
      <IOSInstallSheet open={iosSheetOpen} onClose={() => setIosSheetOpen(false)} />
    </>
  );
}

/** Install button for header / settings */
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
  const [iosSheetOpen, setIosSheetOpen] = useState(false);

  if (isInstalled) {
    return (
      <span className="text-xs text-muted-foreground">{t("installed")}</span>
    );
  }

  if (isIOS) {
    return (
      <>
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={() => setIosSheetOpen(true)}
        >
          <Share className="mr-1.5 h-3.5 w-3.5" />
          {t("iosShort")}
        </Button>
        <IOSInstallSheet open={iosSheetOpen} onClose={() => setIosSheetOpen(false)} />
      </>
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

export { getRecommendationCount };
