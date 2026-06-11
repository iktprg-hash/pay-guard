import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PwaProviders } from "@/components/pwa/PwaProviders";
import {
  IOS_SPLASH_SCREENS,
  PWA_APP_NAME,
  PWA_BACKGROUND_COLOR,
  PWA_DESCRIPTIONS,
  PWA_THEME_COLOR,
  type PwaLocale,
} from "@/lib/pwa/config";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safe = (routing.locales.includes(locale as PwaLocale)
    ? locale
    : "cs") as PwaLocale;

  return {
    applicationName: PWA_APP_NAME,
    title: {
      default: PWA_APP_NAME,
      template: `%s | ${PWA_APP_NAME}`,
    },
    description: PWA_DESCRIPTIONS[safe],
    manifest: `/${safe}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: PWA_APP_NAME,
    },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png" },
      ],
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
  };
}

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "cs" | "ru" | "en")) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={PWA_APP_NAME} />
        <link rel="apple-touch-icon" href="/icons/icon-180x180.png" />
        {IOS_SPLASH_SCREENS.map((splash) => (
          <link
            key={splash.href}
            rel="apple-touch-startup-image"
            href={splash.href}
            media={splash.media}
          />
        ))}
      </head>
      <body
        className="flex min-h-full flex-col antialiased"
        style={{ backgroundColor: PWA_BACKGROUND_COLOR }}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <PwaProviders>
              <AppShell>{children}</AppShell>
            </PwaProviders>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
