import type { jsPDF } from "jspdf";
import type { Locale } from "@/i18n/routing";

const FONT_FILE = "NotoSans-Regular.ttf";
const FONT_VFS_NAME = "NotoSans-Regular.ttf";
const FONT_FAMILY = "NotoSans";

let fontRegistered = false;

/** Locales that need a Unicode font (Cyrillic, Czech diacritics). */
export function needsUnicodeFont(locale: Locale): boolean {
  return locale === "ru" || locale === "cs";
}

export function getPdfFontFamily(locale: Locale): string {
  return needsUnicodeFont(locale) ? FONT_FAMILY : "helvetica";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Registers Noto Sans for jsPDF (once per page load). */
export async function registerPdfUnicodeFont(doc: jsPDF): Promise<void> {
  if (fontRegistered) return;

  const res = await fetch(`/fonts/${FONT_FILE}`);
  if (!res.ok) {
    throw new Error(`PDF font load failed: ${res.status}`);
  }

  const base64 = arrayBufferToBase64(await res.arrayBuffer());
  doc.addFileToVFS(FONT_VFS_NAME, base64);
  doc.addFont(FONT_VFS_NAME, FONT_FAMILY, "normal");
  doc.addFont(FONT_VFS_NAME, FONT_FAMILY, "bold");
  fontRegistered = true;
}

/** Reset cached font state (tests only). */
export function resetPdfFontCacheForTests(): void {
  fontRegistered = false;
}
