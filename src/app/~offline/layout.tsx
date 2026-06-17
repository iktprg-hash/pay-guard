import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Pay Guard — Offline",
  themeColor: "#6366f1",
};

/** Standalone shell for Serwist offline fallback (outside [locale] layout). */
export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
