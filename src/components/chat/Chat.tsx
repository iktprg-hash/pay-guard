"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { History, Plus, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-provider";
import { Message } from "./Message";
import { Input } from "./Input";
import { ChatWelcome } from "./ChatWelcome";
import { TypingIndicator } from "./TypingIndicator";
import { useAuth } from "@/components/providers/auth-provider";
import { useFinancialProfile } from "@/hooks/use-financial-profile";
import { useChatWithPro } from "@/hooks/use-chat-with-pro";
import { useChatHistory } from "@/hooks/use-chat-history";
import { getOrCreateSessionCredentials, createNewLocalSession, listLocalSessions } from "@/lib/chat/storage";
import { persistChatRecommendation } from "@/lib/chat/persist-recommendation";
import { mergeProfileUpdate } from "@/lib/types/financial";
import { resolvePrioritization } from "@/lib/recommendation/resolve-prioritization";
import { GrokConsentGate } from "./GrokConsentGate";
import { ProSyncBar } from "./pro-sync-bar";
import { OfflineRecommendationCard } from "@/components/pwa/OfflineRecommendationCard";
import { ChatSkeleton } from "@/components/ui/page-loader";
import type { ChatMessage, PrioritizationResult } from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";
import { getIntlLocale } from "@/lib/utils";
import {
  appErrorFromResponse,
  getUserErrorMessageFromError,
} from "@/lib/errors";

function generateId() {
  return crypto.randomUUID();
}

export function Chat() {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const paramSessionId = searchParams.get("session");
  const { user, loading: authLoading } = useAuth();
  const dateLocale = getIntlLocale(locale);

  const { profile, setProfile, isReady, reset: resetProfile } =
    useFinancialProfile();

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [canRecommend, setCanRecommend] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isSavingConsultation, setIsSavingConsultation] = useState(false);

  const messagesRef = useRef(messages);
  const profileRef = useRef(profile);
  const bottomRef = useRef<HTMLDivElement>(null);
  messagesRef.current = messages;
  profileRef.current = profile;

  const isAuthenticated = Boolean(user);

  const isEmpty = hydrated && messages.length === 0;

  const {
    isProEnabled,
    isProLoading,
    isOnline,
    syncStatus,
    isSyncing,
    loadFromPro,
    saveToPro,
    persistRecommendationToPro,
  } = useChatWithPro({
    locale,
    profile,
    setProfile,
    chatHydrated: hydrated,
    isEmpty,
  });

  const { restore, createNewSession, saveSession } = useChatHistory({
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
        setProfile(saved.profile);
        profileRef.current = saved.profile;
        if (saved.messages.length) {
          setMessages(saved.messages);
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

  /** After Pro auto-load into empty chat, enable recommendation when data is ready. */
  useEffect(() => {
    if (
      hydrated &&
      messages.length === 0 &&
      profile.debts.length > 0 &&
      profile.availableFunds > 0
    ) {
      setCanRecommend(true);
    }
  }, [hydrated, messages.length, profile.debts.length, profile.availableFunds]);

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
          }),
        });

        if (!res.ok) {
          const appError = await appErrorFromResponse(res, locale);
          throw appError;
        }

        const data = await res.json();

        const merged = data.profileUpdate
          ? mergeProfileUpdate(profileRef.current, data.profileUpdate)
          : data.profile ?? profileRef.current;

        setProfile(merged);
        profileRef.current = merged;

        if (data.readyForRecommendation) {
          setCanRecommend(true);
        }

        const assistantMessages: ChatMessage[] = [
          {
            id: generateId(),
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
          },
        ];

        if (data.recommendation) {
          const recommendation = data.recommendation as PrioritizationResult;
          await persistChatRecommendation({
            locale,
            profile: merged,
            recommendation,
            source: "chat",
            isProEnabled,
            persistRecommendationToPro,
          });
          assistantMessages.push({
            id: generateId(),
            role: "assistant",
            content: recommendation.summary,
            timestamp: new Date(),
            recommendation,
          });
          setCanRecommend(false);
        }

        setMessages((prev) => [...prev, ...assistantMessages]);

        if (data.recommendation) {
          void saveSession({
            sessionId,
            messages: [...currentMessages, ...assistantMessages],
            profile: merged,
          });
        }
      } catch (err) {
        const content = getUserErrorMessageFromError(err, locale);
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, locale, setProfile, t, isProEnabled, persistRecommendationToPro, saveSession, sessionId]
  );

  const getRecommendation = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await resolvePrioritization(profileRef.current, locale);

      await persistChatRecommendation({
        locale,
        profile: profileRef.current,
        recommendation: result,
        source: "chat",
        isProEnabled,
        persistRecommendationToPro,
      });

      const recommendationMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: result.summary,
        timestamp: new Date(),
        recommendation: result,
      };

      setMessages((prev) => [...prev, recommendationMessage]);

      void saveSession({
        sessionId,
        messages: [...messagesRef.current, recommendationMessage],
        profile: profileRef.current,
      });
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
  }, [locale, t, isProEnabled, persistRecommendationToPro, saveSession, sessionId]);

  const handleSaveConsultation = useCallback(async () => {
    if (!messagesRef.current.length || isSavingConsultation) return;

    setIsSavingConsultation(true);
    try {
      await saveSession({
        sessionId,
        messages: messagesRef.current,
        profile: profileRef.current,
      });
      toast(t("saveConsultationSuccess"), "success");
    } catch {
      toast(t("saveConsultationError"), "error");
    } finally {
      setIsSavingConsultation(false);
    }
  }, [isSavingConsultation, saveSession, sessionId, t]);

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

  return (
    <GrokConsentGate>
      <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 flex-col gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          <ProSyncBar
            isProEnabled={isProEnabled}
            isProLoading={isProLoading}
            isOnline={isOnline}
            syncStatus={syncStatus}
            isSyncing={isSyncing}
            onLoadFromPro={() => void loadFromPro()}
            onSaveToPro={() => void saveToPro(profileRef.current)}
            className="mt-1.5"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={isSavingConsultation || isLoading}
              onClick={() => void handleSaveConsultation()}
            >
              <Save className="h-3.5 w-3.5" />
              {isSavingConsultation ? t("savingConsultation") : t("saveConsultation")}
            </Button>
          )}
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
        {!hydrated ? (
          <ChatSkeleton />
        ) : isEmpty && !isLoading ? (
          <>
            <OfflineRecommendationCard locale={locale} />
            <ChatWelcome onSuggestion={sendMessage} disabled={isLoading} />
          </>
        ) : (
          <>
            {messages.map((msg) => (
              <Message
                key={msg.id}
                message={msg}
                locale={dateLocale}
                profile={profile}
                downloadKey={sessionId || "chat-recommendation"}
              />
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
