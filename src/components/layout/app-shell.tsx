"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";

/** Skryje header na login/register stránkách */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname.includes("/login") || pathname.includes("/register");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </>
  );
}
