import type { Locale } from "@/i18n/routing";
import type { AppErrorCode } from "@/lib/errors/codes";
import {
  getUserErrorMessage,
  type UserErrorCode,
} from "@/lib/errors/user-messages";

/** @deprecated Prefer {@link getUserErrorMessage} from `@/lib/errors/user-messages`. */
export function getLocalizedErrorMessage(
  code: AppErrorCode,
  locale: Locale
): string {
  return getUserErrorMessage(code, locale);
}

export type { UserErrorCode };
