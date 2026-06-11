/** PWA design tokens — dark theme */
export const PWA_THEME_COLOR = "#6366f1";
export const PWA_BACKGROUND_COLOR = "#0a0a0f";

export const PWA_APP_NAME = "Pay Guard";
export const PWA_SHORT_NAME = "PayGuard";

/** Localized manifest labels */
export const PWA_NAMES = {
  cs: "Pay Guard",
  ru: "Pay Guard",
  en: "Pay Guard",
} as const;

export const PWA_SHORT_NAMES = {
  cs: "PayGuard",
  ru: "PayGuard",
  en: "PayGuard",
} as const;

export const PWA_DESCRIPTIONS = {
  cs: "Chytrý pomocník pro prioritizaci plateb v České republice.",
  ru: "Умный помощник по приоритизации платежей для жителей России.",
  en: "Smart payment prioritization assistant for Czech residents.",
} as const;

export type PwaLocale = keyof typeof PWA_DESCRIPTIONS;

/** Po kolika doporučeních zobrazit install prompt */
export const INSTALL_PROMPT_AFTER_RECOMMENDATIONS = 2;

/** Lokalizované názvy pro manifest shortcuts */
export const PWA_SHORTCUT_LABELS = {
  cs: {
    chat: "Chat",
    manual: "Ruční zadání",
    consultations: "Konzultace",
  },
  ru: {
    chat: "Чат",
    manual: "Ручной ввод",
    consultations: "Консультации",
  },
  en: {
    chat: "Chat",
    manual: "Manual entry",
    consultations: "Consultations",
  },
} as const;

/** iOS startup images (width x height @ scale) */
export const IOS_SPLASH_SCREENS = [
  {
    href: "/splash/apple-splash-1170-2532.png",
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    href: "/splash/apple-splash-1284-2778.png",
    media:
      "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    href: "/splash/apple-splash-1179-2556.png",
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    href: "/splash/apple-splash-1290-2796.png",
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    href: "/splash/apple-splash-1536-2048.png",
    media:
      "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)",
  },
] as const;

export function buildManifest(locale: PwaLocale) {
  const labels = PWA_SHORTCUT_LABELS[locale];

  return {
    id: `pay-guard-${locale}`,
    name: PWA_NAMES[locale],
    short_name: PWA_SHORT_NAMES[locale],
    description: PWA_DESCRIPTIONS[locale],
    start_url: `/${locale}?source=pwa`,
    scope: "/",
    display: "standalone" as const,
    display_override: ["standalone", "minimal-ui", "browser"] as const,
    orientation: "portrait" as const,
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
    lang: locale,
    categories: ["finance", "productivity", "utilities"],
    dir: "ltr" as const,
    prefer_related_applications: false,
    shortcuts: [
      {
        name: labels.chat,
        short_name: labels.chat,
        url: `/${locale}`,
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: labels.manual,
        short_name: labels.manual,
        url: `/${locale}/manual`,
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: labels.consultations,
        short_name: labels.consultations,
        url: `/${locale}/consultations`,
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      {
        src: "/icons/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
      },
      {
        src: "/icons/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/icons/icon-128x128.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: "/icons/icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        src: "/icons/icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
