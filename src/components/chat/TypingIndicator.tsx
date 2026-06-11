"use client";

import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  label?: string;
}

export function TypingIndicator({ label }: TypingIndicatorProps) {
  return (
    <div className="group w-full">
      <div className="mx-auto flex max-w-3xl gap-4 px-4 py-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-2 rounded-full bg-muted-foreground/50",
                  "animate-bounce"
                )}
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          {label && (
            <span className="text-xs text-muted-foreground">{label}</span>
          )}
        </div>
      </div>
    </div>
  );
}
