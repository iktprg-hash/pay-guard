import path from "node:path";
import { Font } from "@react-pdf/renderer";

let registered = false;

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

/** Noto Sans from public/fonts — Cyrillic + Latin + Czech diacritics (Vercel-safe). */
export function ensurePdfFontsRegistered(): void {
  if (registered) return;

  Font.register({
    family: "NotoSans",
    fonts: [
      {
        src: path.join(FONTS_DIR, "NotoSans-Regular.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(FONTS_DIR, "NotoSans-Bold.ttf"),
        fontWeight: 700,
      },
    ],
  });

  registered = true;
}

/** @internal tests */
export function resetPdfFontsForTests(): void {
  registered = false;
}
