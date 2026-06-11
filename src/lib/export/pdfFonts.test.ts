import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPdfFontFamily,
  needsUnicodeFont,
  registerPdfUnicodeFont,
  resetPdfFontCacheForTests,
} from "@/lib/export/pdfFonts";

describe("pdfFonts", () => {
  beforeEach(() => {
    resetPdfFontCacheForTests();
  });

  it("selects unicode font for ru and cs", () => {
    expect(needsUnicodeFont("ru")).toBe(true);
    expect(needsUnicodeFont("cs")).toBe(true);
    expect(needsUnicodeFont("en")).toBe(false);
    expect(getPdfFontFamily("ru")).toBe("NotoSans");
    expect(getPdfFontFamily("en")).toBe("helvetica");
  });

  it("registers Noto Sans in jsPDF once", async () => {
    const addFileToVFS = vi.fn();
    const addFont = vi.fn();
    const doc = { addFileToVFS, addFont } as unknown as import("jspdf").jsPDF;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })
    );
    vi.stubGlobal("btoa", (value: string) =>
      Buffer.from(value, "binary").toString("base64")
    );

    await registerPdfUnicodeFont(doc);
    await registerPdfUnicodeFont(doc);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(addFileToVFS).toHaveBeenCalledTimes(1);
    expect(addFont).toHaveBeenCalledWith(
      "NotoSans-Regular.ttf",
      "NotoSans",
      "normal"
    );
  });
});
