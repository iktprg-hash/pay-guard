import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["cs", "ru", "en"],
  defaultLocale: "cs",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
