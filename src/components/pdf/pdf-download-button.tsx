"use client";

import { Download, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PdfDownloadButtonProps extends Omit<ButtonProps, "children"> {
  isGenerating: boolean;
  downloadLabel: string;
  generatingLabel: string;
  iconClassName?: string;
}

/** Shared PDF download control with loading spinner and a11y attrs. */
export function PdfDownloadButton({
  isGenerating,
  downloadLabel,
  generatingLabel,
  iconClassName = "h-3.5 w-3.5",
  className,
  disabled,
  ...props
}: PdfDownloadButtonProps) {
  const busy = isGenerating || Boolean(disabled);

  return (
    <Button
      {...props}
      disabled={busy}
      aria-busy={isGenerating}
      aria-disabled={busy}
      aria-label={isGenerating ? generatingLabel : downloadLabel}
      className={cn(
        "relative gap-1.5 transition-opacity",
        isGenerating && "opacity-80",
        className
      )}
    >
      {isGenerating ? (
        <Loader2 className={cn(iconClassName, "shrink-0 animate-spin")} aria-hidden />
      ) : (
        <Download className={cn(iconClassName, "shrink-0")} aria-hidden />
      )}
      <span className={cn(isGenerating && "opacity-90")}>
        {isGenerating ? generatingLabel : downloadLabel}
      </span>
    </Button>
  );
}
