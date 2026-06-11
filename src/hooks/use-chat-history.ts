"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  createNewLocalSession,
  deserializeMessages,
  getOrCreateSessionCredentials,
  importServerSession,
  listLocalSessions,
  loadLocalHistory,
  loadStoredSession,
  saveLocalHistory,
  serializeMessages,
  setSessionCredentials,
} from "@/lib/chat/storage";
import {
  listUnsyncedLocalSessions,
  mergeSessionLists,
  pullServerSessionsToLocal,
  type ServerSessionBundle,
  type ServerSessionSummary,
} from "@/lib/chat/sync";
import { saveOfflineSession } from "@/lib/offline/storage";
import type { ChatMessage, FinancialProfile } from "@/lib/types/financial";

interface UseChatHistoryOptions {
  locale: string;
  messages: ChatMessage[];
  profile: FinancialProfile;
  sessionId: string;
  enabled?: boolean;
  isAuthenticated?: boolean;
}

async function fetchServerSessions(): Promise<ServerSessionSummary[]> {
  const res = await fetch("/api/sessions", { credentials: "include" });
  if (!res.ok) return [];
  const data = (await res.json()) as { sessions?: ServerSessionSummary[] };
  return data.sessions ?? [];
}

async function fetchServerSession(
  sessionId: string
): Promise<ServerSessionBundle | null> {
  const res = await fetch(`/api/sessions/${sessionId}`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return (await res.json()) as ServerSessionBundle;
}

async function pushSessionToServer(
  sessionId: string,
  locale: string,
  messages: ChatMessage[],
  profile: FinancialProfile,
  sessionToken?: string
): Promise<void> {
  await fetch("/api/chat/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      sessionId,
      ...(sessionToken ? { sessionToken } : {}),
      locale,
      messages: serializeMessages(messages),
      profile,
    }),
  }).catch(() => {});
}

/**
 * Persistuje historii chatu do localStorage + Supabase.
 * Po přihlášení synchronizuje s cloudem (server má prioritu).
 */
export function useChatHistory({
  locale,
  messages,
  profile,
  sessionId,
  enabled = true,
  isAuthenticated = false,
}: UseChatHistoryOptions) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncFromServer = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !navigator.onLine) return;

    try {
      const serverSessions = await fetchServerSessions();
      const serverIds = new Set(serverSessions.map((s) => s.id));

      await pullServerSessionsToLocal(fetchServerSession, serverSessions);

      const unsynced = await listUnsyncedLocalSessions(serverIds);
      for (const meta of unsynced) {
        const stored = await loadStoredSession(meta.sessionId);
        if (!stored?.messages.length) continue;
        await pushSessionToServer(
          stored.sessionId,
          stored.locale,
          deserializeMessages(stored.messages),
          stored.profile,
          stored.sessionToken || undefined
        );
      }

      mergeSessionLists(serverSessions, await listLocalSessions(locale));
    } catch {
      // offline / auth
    }
  }, [isAuthenticated, locale]);

  useEffect(() => {
    if (!enabled || messages.length === 0) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      void (async () => {
        await saveLocalHistory(locale, messages, profile, sessionId);

        const stored = await loadStoredSession(sessionId);
        const creds = stored
          ? { sessionToken: stored.sessionToken }
          : await getOrCreateSessionCredentials();
        const token = creds.sessionToken;

        await saveOfflineSession(locale, {
          sessionId,
          sessionToken: token,
          locale,
          messages: serializeMessages(messages),
          profile,
          updatedAt: new Date().toISOString(),
        });

        if (!navigator.onLine || !isAuthenticated) return;

        await pushSessionToServer(
          sessionId,
          locale,
          messages,
          profile,
          token
        );
      })();
    }, 500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [messages, profile, locale, enabled, sessionId, isAuthenticated]);

  const restore = useCallback(
    async (targetSessionId?: string): Promise<{
      messages: ChatMessage[];
      profile: FinancialProfile;
      sessionId: string;
    } | null> => {
      if (isAuthenticated && navigator.onLine) {
        await syncFromServer();
      }

      const local = await loadLocalHistory(locale, targetSessionId);
      if (local) {
        return {
          messages: local.messages,
          profile: local.profile,
          sessionId: local.sessionId,
        };
      }

      if (!isAuthenticated || !navigator.onLine) return null;

      try {
        if (targetSessionId) {
          const bundle = await fetchServerSession(targetSessionId);
          if (bundle) {
            const existingToken =
              (await loadStoredSession(bundle.sessionId))?.sessionToken ?? "";
            await importServerSession({
              sessionId: bundle.sessionId,
              sessionToken: existingToken,
              locale: bundle.locale,
              messages: bundle.messages,
              profile: bundle.profile,
              updatedAt: bundle.updatedAt,
              preview: bundle.preview,
            });
            if (existingToken) {
              await setSessionCredentials(bundle.sessionId, existingToken);
            }
            return {
              messages: deserializeMessages(bundle.messages),
              profile: bundle.profile,
              sessionId: bundle.sessionId,
            };
          }
          return null;
        }

        const res = await fetch("/api/chat/history?latest=1", {
          credentials: "include",
        });
        if (!res.ok) return null;

        const data = (await res.json()) as {
          messages?: ServerSessionBundle["messages"];
          profile?: FinancialProfile | null;
          session?: { sessionId: string } | null;
        };

        if (data.session) {
          const existingToken =
            (await loadStoredSession(data.session.sessionId))?.sessionToken ??
            "";
          if (existingToken) {
            await setSessionCredentials(data.session.sessionId, existingToken);
          }

          await importServerSession({
            sessionId: data.session.sessionId,
            sessionToken: existingToken,
            locale,
            messages: data.messages ?? [],
            profile: data.profile ?? { availableFunds: 0, debts: [] },
            updatedAt: new Date().toISOString(),
          });
          return {
            messages: deserializeMessages(data.messages ?? []),
            profile: data.profile ?? { availableFunds: 0, debts: [] },
            sessionId: data.session.sessionId,
          };
        }
      } catch {
        // fallback
      }

      return null;
    },
    [locale, isAuthenticated, syncFromServer]
  );

  const createNewSession = useCallback(async (): Promise<{
    sessionId: string;
    sessionToken: string;
  }> => {
    if (isAuthenticated && navigator.onLine) {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ locale }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            sessionId: string;
            sessionToken: string;
          };
          await setSessionCredentials(data.sessionId, data.sessionToken);
          await importServerSession({
            sessionId: data.sessionId,
            sessionToken: data.sessionToken,
            locale,
            messages: [],
            profile: { availableFunds: 0, debts: [] },
            updatedAt: new Date().toISOString(),
          });
          return data;
        }
      } catch {
        // fallback local
      }
    }

    return createNewLocalSession(locale);
  }, [isAuthenticated, locale]);

  return { restore, createNewSession, syncFromServer };
}
