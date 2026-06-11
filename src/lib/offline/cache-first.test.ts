import { describe, expect, it, vi } from "vitest";
import { loadSessionCacheFirst } from "@/lib/offline/cache-first";

vi.mock("@/lib/offline/storage", () => ({
  loadOfflineRecommendation: vi.fn(),
  loadOfflineSession: vi.fn(),
}));

vi.mock("@/lib/chat/storage", () => ({
  loadLocalHistory: vi.fn(),
  deserializeMessages: vi.fn((msgs: unknown[]) => msgs),
  serializeMessages: vi.fn((msgs: unknown[]) => msgs),
}));

describe("loadSessionCacheFirst", () => {
  it("prefers IDB offline session over localStorage", async () => {
    const { loadOfflineSession } = await import("@/lib/offline/storage");
    const { loadLocalHistory } = await import("@/lib/chat/storage");

    vi.mocked(loadOfflineSession).mockResolvedValue({
      session: {
        sessionId: "idb-1",
        sessionToken: "tok",
        locale: "cs",
        messages: [],
        profile: { availableFunds: 100, debts: [] },
        updatedAt: new Date().toISOString(),
      },
      savedAt: new Date().toISOString(),
    });
    vi.mocked(loadLocalHistory).mockResolvedValue({
      sessionId: "local-1",
      messages: [],
      profile: { availableFunds: 0, debts: [] },
    });

    const result = await loadSessionCacheFirst("cs");
    expect(result?.sessionId).toBe("idb-1");
    expect(result?.source).toBe("idb-session");
  });
});
