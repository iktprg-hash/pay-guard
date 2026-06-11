import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.stubGlobal("window", globalThis);
vi.stubGlobal("crypto", webcrypto);
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  get length() {
    return storage.size;
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
});
vi.stubGlobal("btoa", (value: string) =>
  Buffer.from(value, "binary").toString("base64")
);
vi.stubGlobal("atob", (value: string) =>
  Buffer.from(value, "base64").toString("binary")
);

beforeEach(() => {
  storage.clear();
  vi.resetModules();
});

describe("chat/storage", () => {
  it("creates and loads encrypted session", async () => {
    const {
      createNewLocalSession,
      saveLocalHistory,
      loadLocalHistory,
    } = await import("@/lib/chat/storage");

    const { sessionId } = await createNewLocalSession("ru");
    await saveLocalHistory(
      "ru",
      [
        {
          id: "m1",
          role: "user",
          content: "Приставы",
          timestamp: new Date("2026-01-01T12:00:00Z"),
        },
      ],
      { availableFunds: 5000, debts: [] },
      sessionId
    );

    const loaded = await loadLocalHistory("ru", sessionId);
    expect(loaded?.messages[0]?.content).toBe("Приставы");
    expect(loaded?.profile.availableFunds).toBe(5000);

    const raw = storage.get(`payguard-session-${sessionId}`);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("Приставы");
  });

  it("migrates legacy plaintext storage", async () => {
    const legacy = {
      sessionId: "legacy-id",
      sessionToken: "legacy-token",
      locale: "cs",
      messages: [
        {
          id: "1",
          role: "user",
          content: "Exekuce",
          timestamp: "2026-01-01T12:00:00.000Z",
        },
      ],
      profile: { availableFunds: 1000, debts: [] },
      updatedAt: "2026-01-01T12:00:00.000Z",
    };

    storage.set("payguard-chat-history", JSON.stringify(legacy));

    const { loadLocalHistory } = await import("@/lib/chat/storage");
    const loaded = await loadLocalHistory("cs", "legacy-id");

    expect(loaded?.messages[0]?.content).toBe("Exekuce");
    expect(storage.has("payguard-chat-history")).toBe(false);
    expect(storage.get("payguard-sessions-index")).toBeTruthy();
  });
});
