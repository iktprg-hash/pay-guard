"use client";

import { Shield, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { RecommendationCard } from "./recommendation-card";
import type { ChatMessage } from "@/lib/types/financial";

interface MessageProps {
  message: ChatMessage;
  locale?: string;
}

/** Jednoduchý markdown: **bold**, *italic*, odrážky */
function formatContent(text: string) {
  return text.split("\n").map((line, lineIdx) => {
    const isBullet = line.trimStart().startsWith("- ");
    const content = isBullet ? line.trimStart().slice(2) : line;

    const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return <span key={i}>{part}</span>;
    });

    if (isBullet) {
      return (
        <li key={lineIdx} className="ml-4 list-disc">
          {parts}
        </li>
      );
    }

    return (
      <p key={lineIdx} className={cn(lineIdx > 0 && "mt-2")}>
        {parts.length ? parts : "\u00A0"}
      </p>
    );
  });
}

export function Message({ message, locale }: MessageProps) {
  const t = useTranslations("chat");
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="group w-full">
        <div className="mx-auto flex max-w-3xl justify-end gap-3 px-4 py-3">
          <div className="flex max-w-[85%] flex-col items-end gap-1">
            <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[15px] leading-7 text-primary-foreground shadow-sm">
              <div className="whitespace-pre-wrap">{formatContent(message.content)}</div>
            </div>
            <time className="text-[11px] text-muted-foreground/60">
              {message.timestamp.toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/10">
            <User className="h-4 w-4 text-foreground/70" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group w-full bg-muted/30">
      <div className="mx-auto flex max-w-3xl gap-4 px-4 py-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
          <Shield className="h-4 w-4 text-primary" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("assistant")}
          </p>

          <div className="text-[15px] leading-7 text-foreground">
            {formatContent(message.content)}
          </div>

          {message.recommendation && (
            <RecommendationCard result={message.recommendation} locale={locale} />
          )}

          <time className="block text-[11px] text-muted-foreground/60">
            {message.timestamp.toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
      </div>
    </div>
  );
}
