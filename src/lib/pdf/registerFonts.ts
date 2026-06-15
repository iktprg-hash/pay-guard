import { Font } from "@react-pdf/renderer";

let registered = false;

/** Noto Sans — Cyrillic + Latin + Czech diacritics for server PDF render. */
export function ensurePdfFontsRegistered(): void {
  if (registered) return;

  Font.register({
    family: "NotoSans",
    fonts: [
      {
        src: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
        fontWeight: 400,
      },
      {
        src: "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
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
