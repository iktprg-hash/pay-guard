"use client";

import { Shield } from "lucide-react";
import { useTranslations } from "next-intl";

interface ChatWelcomeProps {
  onSuggestion: (text: string) => void;
  disabled?: boolean;
}

/** Úvodní obrazovka chatu — styl ChatGPT */
export function ChatWelcome({ onSuggestion, disabled }: ChatWelcomeProps) {
  const t = useTranslations("chat");
  const tApp = useTranslations("app");
  const suggestions = t.raw("suggestions") as string[];

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
        <Shield className="h-8 w-8 text-primary" />
      </div>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        {tApp("name")}
      </h1>
      <p className="mt-2 max-w-md text-center text-muted-foreground">
        {t("emptySubtitle")}
      </p>

      <div className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            disabled={disabled}
            className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-accent hover:shadow-md disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <MicHint />
        {t("voiceHint")}
      </p>
    </div>
  );
}

function MicHint() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
