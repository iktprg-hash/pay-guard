import type { Locale } from "@/i18n/routing";
import cs from "@/messages/cs.json";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

const offlineCopy = {
  cs: cs.pwa.offline,
  ru: ru.pwa.offline,
  en: en.pwa.offline,
} as const;

const toastCopy = {
  cs: cs.toast,
  ru: ru.toast,
  en: en.toast,
} as const;

const globalErrorCopy = {
  cs: cs.errors,
  ru: ru.errors,
  en: en.errors,
} as const;

export function pickBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "cs";
  const lang = navigator.language.slice(0, 2);
  if (lang === "ru" || lang === "en") return lang;
  return "cs";
}

export function getOfflineFallbackCopy(locale: Locale) {
  return offlineCopy[locale];
}

export function getToastCopy(locale: Locale) {
  return toastCopy[locale];
}

export function getGlobalErrorCopy(locale: Locale) {
  return globalErrorCopy[locale];
}

export function getAuthConfirmCopy(locale: Locale) {
  const auth = { cs: cs.auth, ru: ru.auth, en: en.auth };
  return auth[locale];
}
