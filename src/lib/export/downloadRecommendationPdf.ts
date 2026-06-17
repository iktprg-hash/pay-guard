import type {
  FinancialProfile,
  PrioritizationResult,
  UserFinancialProfile,
} from "@/lib/types/financial";
import type { Locale } from "@/i18n/routing";
import { apiFetchResponse } from "@/lib/api/client-fetch";
import { AppError } from "@/lib/errors/app-error";
import { getRecommendationPdfFilename } from "@/lib/pdf/filename";

/** @deprecated Use {@link isAppError} with `code === "PRO_REQUIRED"`. */
export function isPdfProRequiredError(error: unknown): boolean {
  return error instanceof AppError && error.code === "PRO_REQUIRED";
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
  const res = await apiFetchResponse("/api/pdf/recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
    locale: options.locale,
  });

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const headerMatch = disposition?.match(/filename="([^"]+)"/);
  const filename =
    headerMatch?.[1] ?? getRecommendationPdfFilename(options.locale);

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
