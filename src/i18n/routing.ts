import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["cs", "ru", "en"],
  defaultLocale: "cs",
  localePrefix: "always",
  /** Русский браузер → /ru, чешский → /cs */
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
