"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

export interface ConsultationCardProps {
  id: string;
  preview: string;
  messageCount: number;
  hasRecommendation: boolean;
  updatedAt: string;
  synced: boolean;
  locale: Locale;
}

export function ConsultationCard({
  id,
  preview,
  messageCount,
  hasRecommendation,
  updatedAt,
  synced,
  locale,
}: ConsultationCardProps) {
  const t = useTranslations("consultations");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-2 text-base font-medium leading-snug">
          {preview || t("untitled")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatDate(updatedAt, locale)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs font-normal">
            {t("messages", { count: messageCount })}
          </Badge>
          {synced ? (
            <Badge variant="default" className="text-xs font-normal">
              {t("synced")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs font-normal">
              {t("localOnly")}
            </Badge>
          )}
          {hasRecommendation ? (
            <Badge variant="outline" className="text-xs font-normal">
              {t("hasRecommendation")}
            </Badge>
          ) : null}
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/${locale}/consultations/${id}`}>{t("view")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
