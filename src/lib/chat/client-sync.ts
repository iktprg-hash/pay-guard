"use client";

import {
  importServerSession,
  listLocalSessions,
  loadStoredSession,
  setSessionCredentials,
} from "@/lib/chat/storage";
import {
  listUnsyncedLocalSessions,
  pullServerSessionsToLocal,
  type ServerSessionBundle,
  type ServerSessionSummary,
} from "@/lib/chat/sync";

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

/** Po přihlášení — stáhne cloud relace a nahraje lokální na server */
export async function syncUserSessionsOnLogin(locale: string): Promise<void> {
  if (!navigator.onLine) return;

  const serverSessions = await fetchServerSessions();
  const serverIds = new Set(serverSessions.map((s) => s.id));

  await pullServerSessionsToLocal(fetchServerSession, serverSessions);

  const unsynced = await listUnsyncedLocalSessions(serverIds);
  for (const meta of unsynced) {
    const stored = await loadStoredSession(meta.sessionId);
    if (!stored) continue;

    await fetch("/api/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sessionId: stored.sessionId,
        sessionToken: stored.sessionToken,
        locale: stored.locale,
        messages: stored.messages,
        profile: stored.profile,
      }),
    }).catch(() => {});
  }

  if (
    serverSessions.length > 0 &&
    !(await listLocalSessions(locale)).length
  ) {
    const latest = serverSessions[0];
    const bundle = await fetchServerSession(latest.id);
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
    }
  }
}

export { fetchServerSessions, fetchServerSession };
