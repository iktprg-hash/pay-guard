"use client";

import { useTranslations } from "next-intl";
import { Smartphone, Shield, Wifi, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstallAppButton } from "@/components/pwa/InstallPrompt";
import { usePwaInstall } from "@/components/pwa/PwaInstallProvider";
import { useNetworkStatus } from "@/components/pwa/NetworkProvider";
import { Separator } from "@/components/ui/separator";

export function SettingsPanel() {
  const t = useTranslations("pwa.settings");
  const { isInstalled, isIOS } = usePwaInstall();
  const { isOnline } = useNetworkStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            {t("installTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("installBody")}</p>
          <InstallAppButton variant="default" size="default" className="w-full sm:w-auto" />
          {isIOS && !isInstalled && (
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              {t("iosInstructions")}
            </p>
          )}
          {isInstalled && (
            <p className="text-sm font-medium text-primary">{t("installedMessage")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wifi className="h-5 w-5 text-primary" />
            {t("offlineTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("offlineBody")}</p>
          <Separator />
          <p>
            {t("status")}:{" "}
            <span className={isOnline ? "text-green-600" : "text-amber-600"}>
              {isOnline ? t("online") : t("offline")}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            {t("aboutTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-start gap-3 text-sm text-muted-foreground">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("aboutBody")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
