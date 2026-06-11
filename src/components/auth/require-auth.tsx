"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

function isPublicPath(pathname: string): boolean {
  return (
    pathname.includes("/login") ||
    pathname.includes("/register") ||
    pathname.includes("/pricing") ||
    pathname.includes("/forgot-password") ||
    pathname.includes("/reset-password")
  );
}

/** Client-side auth gate — nahrazuje proxy redirect na login */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (loading || user || isPublic) return;
    const loginUrl = `${pathname.split("/").slice(0, 2).join("/")}/login`;
    const next = encodeURIComponent(pathname);
    router.replace(`${loginUrl}?next=${next}`);
  }, [user, loading, isPublic, pathname, router]);

  useEffect(() => {
    if (loading || !user || !isPublic) return;
    if (
      pathname.endsWith("/login") ||
      pathname.endsWith("/register") ||
      pathname.endsWith("/forgot-password")
    ) {
      const locale = pathname.split("/")[1] ?? "cs";
      router.replace(`/${locale}`);
    }
  }, [user, loading, isPublic, pathname, router]);

  if (!isPublic && !user && !loading) {
    return null;
  }

  return <>{children}</>;
}
