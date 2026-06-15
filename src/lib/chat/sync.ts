import {
  importServerSession,
  listLocalSessions,
  loadStoredSession,
  type LocalSessionMeta,
  type StoredChatSession,
} from "@/lib/chat/storage";

/** Veřejný souhrn relace ze serveru — bez session tokenu */
export interface ServerSessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
  messageCount: number;
  hasRecommendation: boolean;
  locale: string;
}

/** Detail relace ze serveru — bez session tokenu */
export type ServerSessionBundle = Omit<
  StoredChatSession,
  "sessionToken"
> & {
  sessionId: string;
  updatedAt: string;
  preview: string;
};

/** Sloučí seznam relací — server má prioritu při konfliktu updatedAt; token zůstane lokální */
export function mergeSessionLists(
  server: ServerSessionSummary[],
  local: LocalSessionMeta[]
): LocalSessionMeta[] {
  const map = new Map<string, LocalSessionMeta>();

  for (const s of local) {
    map.set(s.sessionId, s);
  }

  for (const s of server) {
    const existing = map.get(s.id);
    const serverUpdated = new Date(s.updatedAt).getTime();
    const localUpdated = existing
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing || serverUpdated >= localUpdated) {
      map.set(s.id, {
        sessionId: s.id,
        sessionToken: existing?.sessionToken ?? "",
        locale: s.locale,
        updatedAt: s.updatedAt,
        preview: s.preview,
        messageCount: s.messageCount,
        hasRecommendation:
          s.hasRecommendation || existing?.hasRecommendation || false,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Importuje cloud relace do localStorage (server priorita, token z localStorage) */
export async function pullServerSessionsToLocal(
  fetchSession: (sessionId: string) => Promise<ServerSessionBundle | null>,
  summaries: ServerSessionSummary[]
): Promise<void> {
  for (const summary of summaries) {
    const local = await loadStoredSession(summary.id);
    const serverTime = new Date(summary.updatedAt).getTime();
    const localTime = local ? new Date(local.updatedAt).getTime() : 0;

    if (local && localTime > serverTime) continue;

    const bundle = await fetchSession(summary.id);
    if (!bundle) continue;

    const existingToken =
      local?.sessionToken ??
      (await loadStoredSession(summary.id))?.sessionToken ??
      "";

    await importServerSession({
      sessionId: bundle.sessionId,
      sessionToken: existingToken,
      locale: bundle.locale,
      messages: bundle.messages,
      profile: bundle.profile,
      updatedAt: bundle.updatedAt,
      preview: bundle.preview,
    });
  }
}

/** Lokální relace, které ještě nejsou na serveru */
export async function listUnsyncedLocalSessions(
  serverIds: Set<string>
): Promise<LocalSessionMeta[]> {
  return (await listLocalSessions()).filter((s) => !serverIds.has(s.sessionId));
}
