"use client";

import { toast } from "@/components/ui/toast-provider";
import { getToastCopy, pickBrowserLocale } from "@/lib/pwa/static-messages";
import type { FinancialProfile } from "@/lib/types/financial";
import { serializeMessages, type StoredMessage } from "@/lib/chat/storage";
import type { ChatMessage } from "@/lib/types/financial";
import { apiFetchResponse } from "@/lib/api/client-fetch";
import { AppError } from "@/lib/errors/app-error";
import { getUserErrorMessageFromError, isAppError } from "@/lib/errors";
import type { Locale } from "@/i18n/routing";

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

  const locale = (payload.locale === "ru" || payload.locale === "en"
    ? payload.locale
    : "cs") as Locale;

  try {
    return await apiFetchResponse("/api/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: payload.sessionId,
        ...(payload.sessionToken ? { sessionToken: payload.sessionToken } : {}),
        locale: payload.locale,
        messages: normalizeMessages(payload.messages),
        profile: payload.profile,
      }),
      locale,
    });
  } catch (error) {
    if (isAppError(error) && error.code === "PRO_REQUIRED") {
      const copy = getToastCopy(pickBrowserLocale());
      toast(copy.cloudHistoryProOnly, "default");
    } else {
      toast(getUserErrorMessageFromError(error, locale), "error");
    }
    return null;
  }
}
