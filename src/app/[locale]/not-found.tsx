"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const locale = useLocale();
  const t = useTranslations("errors");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">{t("notFound")}</h1>
      <p className="max-w-md text-muted-foreground">{t("notFoundHint")}</p>
      <Button asChild>
        <Link href={`/${locale}`}>{t("backHome")}</Link>
      </Button>
    </div>
  );
}
