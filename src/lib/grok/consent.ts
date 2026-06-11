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
