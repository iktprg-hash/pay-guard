import { describe, expect, it } from "vitest";
import {
  chatRequestSchema,
  financialProfileSchema,
  historyGetSchema,
  historyPostSchema,
  sessionIdSchema,
  sessionTokenSchema,
} from "@/lib/validation/schemas";

const validSessionId = "550e8400-e29b-41d4-a716-446655440000";
const validToken = "a".repeat(32);

describe("sessionIdSchema", () => {
  it("accepts valid UUID", () => {
    expect(sessionIdSchema.safeParse(validSessionId).success).toBe(true);
  });

  it("rejects non-uuid", () => {
    expect(sessionIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("sessionTokenSchema", () => {
  it("accepts tokens with min length 32", () => {
    expect(sessionTokenSchema.safeParse(validToken).success).toBe(true);
  });

  it("rejects short tokens", () => {
    expect(sessionTokenSchema.safeParse("short").success).toBe(false);
  });
});

describe("historyPostSchema", () => {
  const base = {
    sessionId: validSessionId,
    locale: "cs" as const,
    messages: [],
    profile: { availableFunds: 0, debts: [] },
  };

  it("accepts post without sessionToken (authenticated ownership)", () => {
    expect(historyPostSchema.safeParse(base).success).toBe(true);
  });

  it("accepts post with optional sessionToken", () => {
    expect(
      historyPostSchema.safeParse({ ...base, sessionToken: validToken }).success
    ).toBe(true);
  });

  it("rejects invalid locale", () => {
    expect(historyPostSchema.safeParse({ ...base, locale: "de" }).success).toBe(
      false
    );
  });
});

describe("historyGetSchema", () => {
  it("requires sessionId only", () => {
    expect(
      historyGetSchema.safeParse({ sessionId: validSessionId }).success
    ).toBe(true);
  });
});

describe("financialProfileSchema", () => {
  it("rejects negative funds", () => {
    expect(
      financialProfileSchema.safeParse({ availableFunds: -1, debts: [] }).success
    ).toBe(false);
  });

  it("caps debt count", () => {
    const debts = Array.from({ length: 51 }, (_, i) => ({
      creditor: `Creditor ${i}`,
      amount: 100,
    }));
    expect(
      financialProfileSchema.safeParse({ availableFunds: 0, debts }).success
    ).toBe(false);
  });
});

describe("chatRequestSchema", () => {
  it("accepts minimal valid chat request", () => {
    expect(
      chatRequestSchema.safeParse({
        messages: [{ role: "user", content: "Hello" }],
        profile: { availableFunds: 1000, debts: [] },
        locale: "cs",
      }).success
    ).toBe(true);
  });

  it("rejects empty messages", () => {
    expect(
      chatRequestSchema.safeParse({
        messages: [],
        profile: { availableFunds: 0, debts: [] },
      }).success
    ).toBe(false);
  });
});
