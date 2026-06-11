"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { History, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message } from "./Message";
import { Input } from "./Input";
import { ChatWelcome } from "./ChatWelcome";
import { TypingIndicator } from "./TypingIndicator";
import { useAuth } from "@/components/providers/auth-provider";
import { useFinancialProfile } from "@/hooks/use-financial-profile";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useNetworkStatus } from "@/components/pwa/NetworkProvider";
import { getOrCreateSessionCredentials, createNewLocalSession, listLocalSessions } from "@/lib/chat/storage";
import { mergeProfileUpdate } from "@/lib/grok/prompts";
import { persistRecommendationOffline } from "@/lib/pwa/persistRecommendation";
import { runPriorityEngine } from "@/services/priorityEngine";
import { GrokConsentGate } from "./GrokConsentGate";
import { OfflineRecommendationCard } from "@/components/pwa/OfflineRecommendationCard";
import type { ChatMessage, PrioritizationResult } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";

function generateId() {
  return crypto.randomUUID();
}

export function Chat() {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const paramSessionId = searchParams.get("session");
  const { user, loading: authLoading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const dateLocale =
    locale === "cs" ? "cs-CZ" : locale === "ru" ? "ru-RU" : "en-US";

  const { profile, mergeProfile, isReady, reset: resetProfile } =
    useFinancialProfile();

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [canRecommend, setCanRecommend] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const messagesRef = useRef(messages);
  const profileRef = useRef(profile);
  const bottomRef = useRef<HTMLDivElement>(null);
  messagesRef.current = messages;
  profileRef.current = profile;

  const isAuthenticated = Boolean(user);

  const { restore, createNewSession } = useChatHistory({
    locale,
    messages,
    profile,
    sessionId,
    enabled: hydrated && Boolean(sessionId) && messages.length > 0,
    isAuthenticated,
  });

  useEffect(() => {
    if (authLoading) return;

    void (async () => {
      let targetId = paramSessionId ?? undefined;
      if (!targetId) {
        const existing = await listLocalSessions(locale);
        if (existing.length) {
          targetId = existing[0].sessionId;
        } else {
          targetId = (await createNewLocalSession(locale)).sessionId;
        }
      } else {
        await getOrCreateSessionCredentials();
      }
      setSessionId(targetId);

      const saved = await restore(targetId);
      if (saved) {
        setSessionId(saved.sessionId);
        if (saved.messages.length) {
          setMessages(saved.messages);
          mergeProfile(saved.profile);
          if (
            saved.profile.debts.length > 0 &&
            saved.profile.availableFunds > 0
          ) {
            setCanRecommend(true);
          }
        }
      }
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, paramSessionId]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    if (hydrated && messages.length > 0) scrollToBottom();
  }, [messages, isLoading, hydrated, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const currentMessages = [...messagesRef.current, userMessage];
      setMessages(currentMessages);
      setInput("");
      setIsLoading(true);

      try {
        if (!navigator.onLine) {
          throw new Error("OFFLINE");
        }

        const history = currentMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: history,
            profile: profileRef.current,
            locale,
            grokConsent: true as const,
          }),
        });

        if (!res.ok) throw new Error("Chat failed");

        const data = await res.json();

        if (data.profileUpdate) {
          const merged = mergeProfileUpdate(
            profileRef.current,
            data.profileUpdate
          );
          mergeProfile(merged);
          profileRef.current = merged;
          if (
            data.profileUpdate.readyForRecommendation ||
            (merged.debts.length > 0 && merged.availableFunds > 0)
          ) {
            setCanRecommend(true);
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        const offline = err instanceof Error && err.message === "OFFLINE";
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: offline ? t("offlineError") : t("error"),
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, locale, mergeProfile, t]
  );

  const getRecommendation = useCallback(async () => {
    setIsLoading(true);
    try {
      let result: PrioritizationResult;

      if (!isOnline) {
        result = runPriorityEngine(profileRef.current, locale);
      } else {
        const res = await fetch("/api/prioritize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ profile: profileRef.current, locale }),
        });

        if (!res.ok) throw new Error("Prioritize failed");
        result = await res.json();
      }

      await persistRecommendationOffline(
        locale,
        profileRef.current,
        result,
        "chat"
      );

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: result.summary,
          timestamp: new Date(),
          recommendation: result,
        },
      ]);
      setCanRecommend(false);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: t("error"),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, locale, t]);

  const startNewChat = async () => {
    const creds = await createNewSession();
    setSessionId(creds.sessionId);
    resetProfile();
    profileRef.current = { availableFunds: 0, debts: [] };
    setCanRecommend(false);
    setMessages([]);
    setInput("");
    window.history.replaceState(null, "", `/${locale}`);
  };

  const isEmpty = hydrated && messages.length === 0;

  return (
    <GrokConsentGate>
      <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b bg-background/80 px-4 py-2 backdrop-blur-sm">
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs">
            <Link href={`/${locale}/consultations`}>
              <History className="h-3.5 w-3.5" />
              {t("history")}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void startNewChat()}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("newChat")}
          </Button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        aria-live="polite"
        aria-relevant="additions"
        aria-atomic="false"
      >
        {isEmpty && !isLoading ? (
          <>
            <OfflineRecommendationCard locale={locale} />
            <ChatWelcome onSuggestion={sendMessage} disabled={isLoading} />
          </>
        ) : (
          <>
            {messages.map((msg) => (
              <Message key={msg.id} message={msg} locale={dateLocale} />
            ))}
            {isLoading && <TypingIndicator label={t("thinking")} />}
          </>
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {(canRecommend || isReady) && !isLoading && messages.length > 0 && (
        <div className="shrink-0 border-t bg-primary/5 px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {t("recommendationReady")}
            </p>
            <Button
              onClick={getRecommendation}
              size="sm"
              className="shrink-0 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {t("getRecommendation")}
            </Button>
          </div>
        </div>
      )}

      <div className="shrink-0 border-t bg-background/90 pt-3 backdrop-blur-md">
        <Input
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          locale={locale}
          disabled={isLoading}
        />
      </div>
      </div>
    </GrokConsentGate>
  );
}
