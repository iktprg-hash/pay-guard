/**
 * Client-side encryption for local PII (AES-GCM).
 * Protects data at rest on shared devices — does NOT stop XSS with full page access.
 */

const KEY_STORAGE = "payguard-storage-key-v1";
const ENVELOPE_PREFIX = "pg1:";

let cachedKey: CryptoKey | null = null;
let initPromise: Promise<void> | null = null;

function hasWebCrypto(): boolean {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

async function importRawKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toBuffer(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  if (!hasWebCrypto()) {
    throw new Error("Web Crypto unavailable");
  }

  if (typeof localStorage !== "undefined") {
    const existing = localStorage.getItem(KEY_STORAGE);
    if (existing) {
      return importRawKey(base64ToBytes(existing));
    }

    const raw = crypto.getRandomValues(new Uint8Array(32));
    localStorage.setItem(KEY_STORAGE, bytesToBase64(raw));
    return importRawKey(raw);
  }

  const raw = crypto.getRandomValues(new Uint8Array(32));
  return importRawKey(raw);
}

/** Must run once on client before encrypted reads/writes */
export async function ensureLocalStorageCrypto(): Promise<void> {
  if (cachedKey) return;
  if (!initPromise) {
    initPromise = loadOrCreateKey().then((key) => {
      cachedKey = key;
    });
  }
  await initPromise;
}

export function isEncryptedPayload(value: string): boolean {
  return value.startsWith(ENVELOPE_PREFIX);
}

export async function encryptLocalPayload(plaintext: string): Promise<string> {
  if (!hasWebCrypto()) return plaintext;

  await ensureLocalStorageCrypto();
  if (!cachedKey) return plaintext;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toBuffer(iv) },
    cachedKey,
    encoded
  );

  return `${ENVELOPE_PREFIX}${bytesToBase64(iv)}.${bytesToBase64(toBuffer(new Uint8Array(cipher)))}`;
}

export async function decryptLocalPayload(
  stored: string
): Promise<string | null> {
  if (!isEncryptedPayload(stored)) return stored;

  if (!hasWebCrypto()) return null;

  await ensureLocalStorageCrypto();
  if (!cachedKey) return null;

  try {
    const body = stored.slice(ENVELOPE_PREFIX.length);
    const [ivPart, cipherPart] = body.split(".");
    if (!ivPart || !cipherPart) return null;

    const iv = toBuffer(base64ToBytes(ivPart));
    const cipher = toBuffer(base64ToBytes(cipherPart));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cachedKey,
      cipher
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Removes encryption key and in-memory cache (logout / wipe) */
export function clearLocalCryptoKey(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(KEY_STORAGE);
  }
  cachedKey = null;
  initPromise = null;
}
