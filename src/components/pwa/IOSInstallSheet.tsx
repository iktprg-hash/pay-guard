"use client";

import { useTranslations } from "next-intl";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IOSInstallSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * iOS has no beforeinstallprompt — show step-by-step Add to Home Screen guide.
 */
export function IOSInstallSheet({ open, onClose }: IOSInstallSheetProps) {
  const t = useTranslations("pwa.install");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-in slide-in-from-bottom-4 rounded-2xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
              <Share className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 id="ios-install-title" className="font-semibold">
                {t("iosStepsTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("iosStepsSubtitle")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("dismiss")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="space-y-3 text-sm">
          {[t("iosStep1"), t("iosStep2"), t("iosStep3")].map((step, i) => (
            <li key={i} className="flex gap-3 rounded-xl bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <Button className="mt-5 w-full" onClick={onClose}>
          {t("iosStepsDone")}
        </Button>
      </div>
    </div>
  );
}
