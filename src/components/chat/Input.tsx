"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowUp, Mic, MicOff, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/hooks/use-speech";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  locale: string;
  disabled?: boolean;
}

export function Input({
  value,
  onChange,
  onSend,
  locale,
  disabled,
}: ChatInputProps) {
  const t = useTranslations("chat");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, isSupported, toggle, stop } = useSpeech({
    locale,
    onResult: (transcript) => {
      onChange(transcript);
      onSend(transcript);
    },
    onInterim: (transcript) => onChange(transcript),
  });

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    if (isListening) stop();
    onSend(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-3">
      <div
        className={cn(
          "relative flex items-end gap-1 rounded-[26px] border border-border/80 bg-background p-1.5 shadow-[0_2px_24px_rgba(0,0,0,0.06)] transition-all",
          "focus-within:border-primary/50 focus-within:shadow-[0_4px_32px_rgba(29,78,216,0.12)]",
          isListening && "border-destructive/50 ring-2 ring-destructive/15"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          disabled={disabled || !isSupported}
          className={cn(
            "h-10 w-10 shrink-0 rounded-full",
            isListening && "bg-destructive/10 text-destructive hover:bg-destructive/20"
          )}
          aria-label={
            !isSupported
              ? t("voiceUnsupported")
              : isListening
                ? t("voiceStop")
                : t("voiceStart")
          }
          title={
            !isSupported
              ? t("voiceUnsupported")
              : isListening
                ? t("voiceStop")
                : t("voiceStart")
          }
        >
          {isListening ? (
            <Square className="h-4 w-4 fill-current" />
          ) : isSupported ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4 opacity-40" />
          )}
        </Button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? t("listening") : t("placeholder")}
          disabled={disabled}
          rows={1}
          className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-6 outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
        />

        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={cn(
            "h-10 w-10 shrink-0 rounded-full transition-all",
            value.trim()
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground"
          )}
          aria-label={t("send")}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
        {isListening ? (
          <span className="text-destructive animate-pulse">{t("listening")}</span>
        ) : (
          t("keyboardHint")
        )}
      </p>
    </div>
  );
}
