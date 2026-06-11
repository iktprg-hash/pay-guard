import { wipeOfflinePii } from "@/lib/offline/storage";
import { clearAllLocalSessions } from "@/lib/chat/storage";
import { clearLocalCryptoKey } from "@/lib/security/local-crypto";
import { clearGrokConsent } from "@/lib/grok/consent";

/** Odstraní lokální PII a rotuje šifrovací klíč */
export async function wipeLocalPii(): Promise<void> {
  await clearAllLocalSessions();
  await wipeOfflinePii();
  clearLocalCryptoKey();
  clearGrokConsent();
}
