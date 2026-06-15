"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProRefreshingIndicatorProps {
  visible: boolean;
  label: string;
  className?: string;
}

/** Subtle banner while TanStack Query refetches Pro profile data. */
export function ProRefreshingIndicator({
  visible,
  label,
  className,
}: ProRefreshingIndicatorProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
