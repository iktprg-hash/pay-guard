"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateSessionCredentials } from "@/lib/chat/storage";
import { syncUserSessionsOnLogin } from "@/lib/chat/client-sync";
import { wipeLocalPii } from "@/lib/security/wipe-local-pii";
import type { Locale } from "@/i18n/routing";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function claimAnonymousSession(): Promise<void> {
  const { sessionId, sessionToken } = await getOrCreateSessionCredentials();
  await fetch("/api/session/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sessionId, sessionToken }),
  }).catch(() => {});
}

async function syncLocale(userId: string, locale: Locale): Promise<void> {
  await fetch("/api/auth/sync-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ locale }),
  }).catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const locale = useLocale() as Locale;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (event === "SIGNED_IN" && nextUser) {
        await claimAnonymousSession();
        await syncUserSessionsOnLogin(locale);
        await syncLocale(nextUser.id, locale);
      }
    });

    return () => subscription.unsubscribe();
  }, [locale]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});

    const supabase = createClient();
    await supabase.auth.signOut().catch(() => {});
    await wipeLocalPii();
    setUser(null);
    window.location.href = `/${locale}/login`;
  }, [locale]);

  const value = useMemo(
    () => ({ user, loading, signOut }),
    [user, loading, signOut]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
