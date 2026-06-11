"use client";

import { useTranslations } from "next-intl";

export function AppFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-auto border-t bg-muted/20 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {t("disclaimer")}
        </p>
      </div>
    </footer>
  );
}
