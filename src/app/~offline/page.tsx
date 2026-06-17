"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  getOfflineFallbackCopy,
  pickBrowserLocale,
} from "@/lib/pwa/static-messages";
import { loadOfflineBundleCacheFirst } from "@/lib/offline/cache-first";
import type { Locale } from "@/i18n/routing";

export default function OfflinePage() {
  const [locale, setLocale] = useState<Locale>("cs");
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [hasRecommendation, setHasRecommendation] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const l = pickBrowserLocale();
    setLocale(l);

    void loadOfflineBundleCacheFirst(l)
      .then(({ recommendation, session }) => {
        setLastPreview(session?.session?.preview ?? null);
        setHasRecommendation(Boolean(recommendation));
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  const copy = getOfflineFallbackCopy(locale);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16">
      {/* Icon + heading */}
      <div className="flex flex-col items-center gap-4 text-center">
        <WifiOff
          className="h-16 w-16 text-muted-foreground"
          aria-hidden="true"
        />
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="max-w-sm text-muted-foreground">{copy.subtitle}</p>
      </div>

      {/* Cached session preview */}
      {ready && lastPreview ? (
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {copy.lastSessionPreview}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {lastPreview}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Cached recommendation hint */}
      {ready && hasRecommendation ? (
        <Card className="w-full max-w-sm border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {copy.cachedRecommendationTitle}
            </CardTitle>
            <CardDescription>{copy.bannerSubtitle}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {copy.retry}
        </Button>
        <Button asChild>
          <Link href={`/${locale}`}>{copy.backToApp}</Link>
        </Button>
      </div>

      {/* Consultations link — precached, works offline */}
      <p className="text-sm text-muted-foreground">
        <Link
          href={`/${locale}/consultations`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          {copy.viewSession}
        </Link>
      </p>
    </main>
  );
}
