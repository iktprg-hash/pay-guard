import type {
  FinancialProfile,
  PrioritizationResult,
  UserFinancialProfile,
} from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";
import { getRecommendationPdfFilename } from "@/lib/pdf/filename";

export const PDF_ERROR_PRO_REQUIRED = "PRO_REQUIRED";

export class PdfDownloadError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = "PdfDownloadError";
  }
}

export function isPdfProRequiredError(error: unknown): boolean {
  return (
    error instanceof PdfDownloadError &&
    error.code === PDF_ERROR_PRO_REQUIRED
  );
}

export interface DownloadRecommendationPdfOptions {
  recommendation: PrioritizationResult;
  profile?: FinancialProfile | UserFinancialProfile;
  locale: Locale;
}

/** Download Pro recommendation PDF from server API. */
export async function downloadRecommendationPdf(
  options: DownloadRecommendationPdfOptions
): Promise<void> {
  const res = await fetch("/api/pdf/recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(options),
  });

  if (res.status === 403) {
    const data = (await res.json().catch(() => ({}))) as { code?: string };
    throw new PdfDownloadError(
      "Pro subscription required for PDF export",
      data.code ?? PDF_ERROR_PRO_REQUIRED
    );
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new PdfDownloadError(data.error ?? "PDF generation failed");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const headerMatch = disposition?.match(/filename="([^"]+)"/);
  const filename =
    headerMatch?.[1] ??
    getRecommendationPdfFilename(options.locale);

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
