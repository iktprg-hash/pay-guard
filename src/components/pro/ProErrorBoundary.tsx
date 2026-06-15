"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { reportClientError } from "@/lib/errors/report-client-error";

interface ProErrorBoundaryProps {
  children: ReactNode;
}

interface ProErrorBoundaryState {
  error: Error | null;
}

function ProErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  const t = useTranslations("pro.errorBoundary");
  const locale = useLocale() as Locale;

  return (
    <div
      className="flex flex-1 items-center justify-center p-6"
      role="alert"
      aria-live="assertive"
    >
      <Card className="w-full max-w-lg border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="default" className="flex-1">
            <Link href={`/${locale}`}>{t("backToChat")}</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onRetry}
            aria-label={t("retry")}
          >
            {t("retry")}
          </Button>
        </CardContent>
        {process.env.NODE_ENV === "development" && error?.message && (
          <CardContent className="border-t pt-4">
            <p className="font-mono text-xs text-muted-foreground">
              {error.message}
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/** Catches render errors inside the Pro workspace shell. */
export class ProErrorBoundary extends Component<
  ProErrorBoundaryProps,
  ProErrorBoundaryState
> {
  state: ProErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ProErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(error, {
      boundary: "ProErrorBoundary",
      digest: info.componentStack ?? undefined,
    });
  }

  handleRetry = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ProErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
