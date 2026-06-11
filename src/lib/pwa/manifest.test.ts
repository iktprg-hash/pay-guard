import { describe, expect, it } from "vitest";
import { buildManifest } from "@/lib/pwa/config";

describe("buildManifest", () => {
  it("includes standalone display and maskable icons for each locale", () => {
    for (const locale of ["cs", "ru", "en"] as const) {
      const manifest = buildManifest(locale);
      expect(manifest.display).toBe("standalone");
      expect(manifest.start_url).toBe(`/${locale}`);
      expect(manifest.lang).toBe(locale);
      expect(manifest.shortcuts?.length).toBeGreaterThanOrEqual(3);
      expect(
        manifest.icons.some(
          (i) => i.purpose === "maskable" && i.sizes === "512x512"
        )
      ).toBe(true);
    }
  });
});
