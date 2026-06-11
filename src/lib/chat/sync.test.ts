import { describe, expect, it } from "vitest";
import { mergeSessionLists, type ServerSessionSummary } from "@/lib/chat/sync";
import type { LocalSessionMeta } from "@/lib/chat/storage";

describe("mergeSessionLists", () => {
  it("preserves local sessionToken when merging server summaries", () => {
    const server: ServerSessionSummary[] = [
      {
        id: "sess-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        preview: "Hello",
        messageCount: 2,
        hasRecommendation: false,
        locale: "cs",
      },
    ];

    const local: LocalSessionMeta[] = [
      {
        sessionId: "sess-1",
        sessionToken: "local-secret-token-32chars-minimum!!",
        locale: "cs",
        updatedAt: "2026-01-01T00:00:00.000Z",
        preview: "Old",
        messageCount: 1,
      },
    ];

    const merged = mergeSessionLists(server, local);
    expect(merged).toHaveLength(1);
    expect(merged[0].sessionToken).toBe("local-secret-token-32chars-minimum!!");
    expect(merged[0]).not.toHaveProperty("sessionToken", undefined);
  });

  it("server summaries do not expose sessionToken field", () => {
    const summary: ServerSessionSummary = {
      id: "sess-2",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      preview: "Test",
      messageCount: 0,
      hasRecommendation: false,
      locale: "en",
    };

    expect("sessionToken" in summary).toBe(false);
  });
});
