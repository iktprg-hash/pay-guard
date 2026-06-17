import type { Metadata, Viewport } from "next";
import { PWA_THEME_COLOR } from "@/lib/pwa/config";
import "../globals.css";

export const metadata: Metadata = {
  title: "Pay Guard — Offline",
};

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
};

/** Standalone shell for Serwist offline fallback (outside [locale] layout). */
export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
