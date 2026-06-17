"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  createNewLocalSession,
  deserializeMessages,
  getOrCreateSessionCredentials,
  importServerSession,
  listLocalSessions as listLocalSessionsFromStorage,
  loadLocalHistory,
  loadStoredSession,
  saveLocalHistory,
  serializeMessages,
  setSessionCredentials,
  type LocalSessionMeta,
} from "@/lib/chat/storage";
import {
  listUnsyncedLocalSessions,
  mergeSessionLists,
  pullServerSessionsToLocal,
  type ServerSessionBundle,
  type ServerSessionSummary,
} from "@/lib/chat/sync";
import { saveOfflineSession } from "@/lib/offline/storage";
import { loadSessionCacheFirst } from "@/lib/offline/cache-first";
import { pushChatHistoryToServer } from "@/lib/chat/push-history";
import type { ChatMessage, FinancialProfile } from "@/lib/types/financial";

interface UseChatHistoryOptions {
  locale: string;
  messages: ChatMessage[];
  profile: FinancialProfile;
  sessionId: string;
  enabled?: boolean;
  isAuthenticated?: boolean;
}

export interface SavedChatSession {
  messages: ChatMessage[];
  profile: FinancialProfile;
  sessionId: string;
}

export interface SaveSessionInput {
  sessionId?: string;
  messages?: ChatMessage[];
  profile?: FinancialProfile;
}

/** Unified session row for the consultations list UI */
export interface ConsultationSessionItem {
  sessionId: string;
  locale: string;
  updatedAt: string;
  preview: string;
  messageCount: number;
  hasRecommendation: boolean;
  /** Present in Pro cloud (financial_sessions + chat_messages) */
  isSynced: boolean;
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
  const data = (await res.json()) as {
    session?: ServerSessionBundle;
  } & Partial<ServerSessionBundle>;
  return data.session ?? (data as ServerSessionBundle);
}

async function pushSessionToServer(
  sessionId: string,
  locale: string,
  messages: ChatMessage[],
  profile: FinancialProfile,
  sessionToken?: string
): Promise<void> {
  await pushChatHistoryToServer({
    sessionId,
    sessionToken,
    locale,
    messages,
    profile,
  });
}

/** Imperative save — localStorage, IndexedDB, optional cloud push. */
async function persistSession(
  locale: string,
  sessionId: string,
  messages: ChatMessage[],
  profile: FinancialProfile,
  isAuthenticated: boolean
): Promise<void> {
  if (messages.length === 0) return;

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

  await pushSessionToServer(sessionId, locale, messages, profile, token);
}

/**
 * Chat history hook — localStorage + IndexedDB + cloud sync for Pro users.
 *
 * Exposes `restore`, `createNewSession`, `saveSession`, and `listLocalSessions`.
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

      mergeSessionLists(serverSessions, await listLocalSessionsFromStorage(locale));
    } catch {
      // offline / auth — keep local data
    }
  }, [isAuthenticated, locale]);

  const listLocalSessions = useCallback(async (): Promise<LocalSessionMeta[]> => {
    return listLocalSessionsFromStorage(locale);
  }, [locale]);

  const listSessions = useCallback(async (): Promise<ConsultationSessionItem[]> => {
    let server: ServerSessionSummary[] = [];

    if (isAuthenticated && navigator.onLine) {
      try {
        await syncFromServer();
        server = await fetchServerSessions();
      } catch (error) {
        console.error("[useChatHistory] listSessions sync failed", error);
      }
    }

    const local = await listLocalSessionsFromStorage(locale);
    const merged =
      server.length > 0 ? mergeSessionLists(server, local) : local;
    const serverById = new Map(server.map((s) => [s.id, s]));

    return merged.map((s) => ({
      sessionId: s.sessionId,
      locale: s.locale,
      updatedAt: s.updatedAt,
      preview: s.preview,
      messageCount: s.messageCount,
      hasRecommendation:
        s.hasRecommendation ??
        serverById.get(s.sessionId)?.hasRecommendation ??
        false,
      isSynced: serverById.has(s.sessionId),
    }));
  }, [isAuthenticated, locale, syncFromServer]);

  const saveSession = useCallback(
    async (input: SaveSessionInput = {}): Promise<void> => {
      const sid = input.sessionId ?? sessionId;
      const msgs = input.messages ?? messages;
      const prof = input.profile ?? profile;

      try {
        await persistSession(locale, sid, msgs, prof, isAuthenticated);
      } catch (error) {
        console.error("[useChatHistory] saveSession failed", error);
        throw error;
      }
    },
    [locale, sessionId, messages, profile, isAuthenticated]
  );

  useEffect(() => {
    if (!enabled || messages.length === 0) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      void saveSession().catch(() => {
        // debounced auto-save — errors logged in saveSession
      });
    }, 500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [messages, profile, enabled, saveSession]);

  const restore = useCallback(
    async (targetSessionId?: string): Promise<SavedChatSession | null> => {
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

      if (!navigator.onLine) {
        const cached = await loadSessionCacheFirst(
          locale as "cs" | "ru" | "en",
          targetSessionId
        );
        if (cached) {
          return {
            messages: cached.messages,
            profile: cached.profile,
            sessionId: cached.sessionId,
          };
        }
        return null;
      }

      if (!isAuthenticated) return null;

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
      } catch (error) {
        console.error("[useChatHistory] restore failed", error);
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
        // fallback to local-only session
      }
    }

    return createNewLocalSession(locale);
  }, [isAuthenticated, locale]);

  return {
    restore,
    createNewSession,
    saveSession,
    listLocalSessions,
    listSessions,
    syncFromServer,
  };
}
