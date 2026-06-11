import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const idbStore = new Map<string, unknown>();

vi.stubGlobal("crypto", webcrypto);
vi.stubGlobal("btoa", (value: string) =>
  Buffer.from(value, "binary").toString("base64")
);
vi.stubGlobal("atob", (value: string) =>
  Buffer.from(value, "base64").toString("binary")
);

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    idbStore.delete(key);
  }),
}));

beforeEach(() => {
  idbStore.clear();
  vi.resetModules();
});

describe("offline/storage", () => {
  it("encrypts recommendation snapshots in IDB", async () => {
    const { saveOfflineRecommendation, loadOfflineRecommendation } =
      await import("@/lib/offline/storage");

    await saveOfflineRecommendation({
      locale: "ru",
      result: {
        summary: "Тест",
        lifeBuffer: 0,
        lifeBufferPercent: 0,
        remainingFunds: 1000,
        recommendations: [],
        warnings: [],
      },
      profile: { availableFunds: 1000, debts: [] },
      savedAt: "2026-01-01T12:00:00.000Z",
      source: "chat",
    });

    const raw = idbStore.get("payguard-pwa-last-recommendation-ru");
    expect(typeof raw).toBe("string");
    expect(String(raw)).not.toContain("Тест");

    const loaded = await loadOfflineRecommendation("ru");
    expect(loaded?.result.summary).toBe("Тест");
  });

  it("reads legacy plaintext IDB values", async () => {
    idbStore.set(
      "payguard-pwa-last-session-cs",
      JSON.stringify({
        session: {
          sessionId: "s1",
          sessionToken: "t1",
          locale: "cs",
          messages: [],
          profile: { availableFunds: 0, debts: [] },
          updatedAt: "2026-01-01T12:00:00.000Z",
        },
        savedAt: "2026-01-01T12:00:00.000Z",
      })
    );

    const { loadOfflineSession } = await import("@/lib/offline/storage");
    const loaded = await loadOfflineSession("cs");
    expect(loaded?.session.sessionId).toBe("s1");
  });
});
