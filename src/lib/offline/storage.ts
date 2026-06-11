import { del } from "idb-keyval";
import {
  decryptLocalPayload,
  encryptLocalPayload,
  isEncryptedPayload,
} from "@/lib/security/local-crypto";

const KEYS = {
  recommendationCount: "payguard-pwa-recommendation-count",
  lastRecommendation: (locale: string) =>
    `payguard-pwa-last-recommendation-${locale}`,
  lastSession: (locale: string) => `payguard-pwa-last-session-${locale}`,
  installDismissed: "payguard-pwa-install-dismissed",
  installShown: "payguard-pwa-install-shown",
} as const;

async function secureSet<T>(key: string, value: T): Promise<void> {
  const { set } = await import("idb-keyval");
  const plaintext = JSON.stringify(value);
  await set(key, await encryptLocalPayload(plaintext));
}

async function secureGet<T>(key: string): Promise<T | null> {
  const { get } = await import("idb-keyval");
  const raw = await get<string>(key);
  if (!raw) return null;

  const plaintext = isEncryptedPayload(raw)
    ? await decryptLocalPayload(raw)
    : raw;

  if (!plaintext) return null;

  try {
    const parsed = JSON.parse(plaintext) as T;
    if (isEncryptedPayload(raw)) {
      await secureSet(key, parsed);
    }
    return parsed;
  } catch {
    return null;
  }
}

export type {
  OfflineRecommendationSnapshot,
  OfflineSessionSnapshot,
} from "@/lib/offline/storage.types";

import type {
  OfflineRecommendationSnapshot,
  OfflineSessionSnapshot,
} from "@/lib/offline/storage.types";

/** Počet úspěšných doporučení (pro install prompt) */
export async function getRecommendationCount(): Promise<number> {
  const { get } = await import("idb-keyval");
  return (await get<number>(KEYS.recommendationCount)) ?? 0;
}

export async function incrementRecommendationCount(): Promise<number> {
  const { set, get } = await import("idb-keyval");
  const next = ((await get<number>(KEYS.recommendationCount)) ?? 0) + 1;
  await set(KEYS.recommendationCount, next);
  return next;
}

/** Uloží poslední doporučení pro offline režim */
export async function saveOfflineRecommendation(
  snapshot: OfflineRecommendationSnapshot
): Promise<void> {
  await secureSet(KEYS.lastRecommendation(snapshot.locale), snapshot);
  await incrementRecommendationCount();
}

/** Poslední doporučení pro danou lokalitu */
export async function loadOfflineRecommendation(
  locale: string
): Promise<OfflineRecommendationSnapshot | null> {
  return secureGet<OfflineRecommendationSnapshot>(
    KEYS.lastRecommendation(locale)
  );
}

/** Snapshot poslední chat relace (localStorage + IDB backup) */
export async function saveOfflineSession(
  locale: string,
  session: OfflineSessionSnapshot["session"]
): Promise<void> {
  const snapshot: OfflineSessionSnapshot = {
    session,
    savedAt: new Date().toISOString(),
  };
  await secureSet(KEYS.lastSession(locale), snapshot);
}

export async function loadOfflineSession(
  locale: string
): Promise<OfflineSessionSnapshot | null> {
  return secureGet<OfflineSessionSnapshot>(KEYS.lastSession(locale));
}

export async function wasInstallPromptDismissed(): Promise<boolean> {
  const { get } = await import("idb-keyval");
  return (await get<boolean>(KEYS.installDismissed)) ?? false;
}

export async function dismissInstallPrompt(): Promise<void> {
  const { set } = await import("idb-keyval");
  await set(KEYS.installDismissed, true);
}

export async function wasInstallBannerShown(): Promise<boolean> {
  const { get } = await import("idb-keyval");
  return (await get<boolean>(KEYS.installShown)) ?? false;
}

export async function markInstallBannerShown(): Promise<void> {
  const { set } = await import("idb-keyval");
  await set(KEYS.installShown, true);
}

/** Všechna offline data pro obrazovku */
export async function loadOfflineBundle(locale: string) {
  const [recommendation, session] = await Promise.all([
    loadOfflineRecommendation(locale),
    loadOfflineSession(locale),
  ]);
  return { recommendation, session };
}

/** Smaže citlivá offline data (zachová install flags) */
export async function wipeOfflinePii(): Promise<void> {
  for (const locale of ["cs", "ru", "en"] as const) {
    await del(KEYS.lastRecommendation(locale));
    await del(KEYS.lastSession(locale));
  }
}
