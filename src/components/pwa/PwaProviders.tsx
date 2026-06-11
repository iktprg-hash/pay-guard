"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { migratePlaintextStorage } from "@/lib/chat/storage";
import { NetworkProvider } from "@/components/pwa/NetworkProvider";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";

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
        <InstallPromptBanner />
      </PwaInstallProvider>
    </NetworkProvider>
  );
}
