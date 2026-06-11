const CONSENT_KEY = "payguard-grok-consent-v1";

export function hasGrokConsent(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(CONSENT_KEY) === "1";
}

export function setGrokConsent(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CONSENT_KEY, "1");
}

export function clearGrokConsent(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CONSENT_KEY);
}

/** Fetch server-side Grok consent (null if unauthenticated or network error). */
export async function fetchServerGrokConsent(): Promise<boolean | null> {
  try {
    const res = await fetch("/api/auth/grok-consent", { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) return false;
    const data = (await res.json()) as { consented?: boolean };
    return Boolean(data.consented);
  } catch {
    return null;
  }
}

/** Record Grok consent on the server profile. */
export async function acceptGrokConsentOnServer(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/grok-consent", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
