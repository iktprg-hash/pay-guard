"use client";

import { useTranslations } from "next-intl";
import { PageLoader } from "@/components/ui/page-loader";

export default function ProtectedLoading() {
  const t = useTranslations("common");
  return <PageLoader label={t("loading")} />;
}
