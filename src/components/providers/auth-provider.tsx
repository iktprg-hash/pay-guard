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
import { toast } from "@/components/ui/toast-provider";
import { getToastCopy } from "@/lib/pwa/static-messages";
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
  const res = await fetch("/api/session/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sessionId, sessionToken }),
  });
  if (!res.ok) {
    throw new Error(`session claim failed (${res.status})`);
  }
}

async function syncLocale(locale: Locale): Promise<void> {
  const res = await fetch("/api/auth/sync-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ locale }),
  });
  if (!res.ok) {
    throw new Error(`locale sync failed (${res.status})`);
  }
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
        try {
          await claimAnonymousSession();
        } catch (err) {
          console.warn("[auth] session claim failed", err);
        }

        try {
          await syncUserSessionsOnLogin(locale);
        } catch (err) {
          console.warn("[auth] cloud session sync failed", err);
          toast(getToastCopy(locale).syncFailed, "error");
        }

        try {
          await syncLocale(locale);
        } catch (err) {
          console.warn("[auth] locale sync failed", err);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [locale]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("[auth] logout API failed", err);
    }

    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[auth] supabase signOut failed", err);
    }

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
