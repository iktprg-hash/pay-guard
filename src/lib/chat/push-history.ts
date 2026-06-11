"use client";

import { toast } from "@/components/ui/toast-provider";
import { getToastCopy, pickBrowserLocale } from "@/lib/pwa/static-messages";
import type { FinancialProfile } from "@/lib/types/financial";
import { serializeMessages, type StoredMessage } from "@/lib/chat/storage";
import type { ChatMessage } from "@/lib/types/financial";

export interface PushHistoryPayload {
  sessionId: string;
  sessionToken?: string;
  locale: string;
  messages: StoredMessage[] | ChatMessage[];
  profile: FinancialProfile;
}

function normalizeMessages(
  messages: StoredMessage[] | ChatMessage[]
): StoredMessage[] {
  if (messages.length === 0) return [];
  const first = messages[0]!;
  if ("timestamp" in first && first.timestamp instanceof Date) {
    return serializeMessages(messages as ChatMessage[]);
  }
  return messages as StoredMessage[];
}

/** POST chat history; shows toast when cloud sync requires Pro (403). */
export async function pushChatHistoryToServer(
  payload: PushHistoryPayload
): Promise<Response | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;

  const res = await fetch("/api/chat/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      sessionId: payload.sessionId,
      ...(payload.sessionToken ? { sessionToken: payload.sessionToken } : {}),
      locale: payload.locale,
      messages: normalizeMessages(payload.messages),
      profile: payload.profile,
    }),
  });

  if (res.status === 403) {
    const copy = getToastCopy(pickBrowserLocale());
    toast(copy.cloudHistoryProOnly, "default");
  }

  return res;
}
