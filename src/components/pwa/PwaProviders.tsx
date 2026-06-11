"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { migratePlaintextStorage } from "@/lib/chat/storage";
import { NetworkProvider } from "@/components/pwa/NetworkProvider";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";

/** Client-only PWA UI — vyhnout se SSR chybám při prerenderu */
const OfflineShell = dynamic(
  () =>
    import("@/components/pwa/OfflineShell").then((m) => m.OfflineShell),
  { ssr: false }
);

const InstallPromptBanner = dynamic(
  () =>
    import("@/components/pwa/InstallPrompt").then((m) => m.InstallPromptBanner),
  { ssr: false }
);

export function PwaProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void migratePlaintextStorage();
  }, []);

  return (
    <NetworkProvider>
      <PwaInstallProvider>
        <RegisterServiceWorker />
        {children}
        <OfflineShell />
        <InstallPromptBanner />
      </PwaInstallProvider>
    </NetworkProvider>
  );
}
