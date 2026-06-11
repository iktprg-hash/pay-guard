import { describe, expect, it } from "vitest";

/** Mirrors claim guard rules in claimSessionForUser */
export function canClaimSession(
  existingUserId: string | null,
  requestingUserId: string
): "allow" | "already_owned" | "deny" {
  if (existingUserId === requestingUserId) return "already_owned";
  if (existingUserId !== null) return "deny";
  return "allow";
}

describe("session claim guards", () => {
  it("allows claim when session is anonymous", () => {
    expect(canClaimSession(null, "user-a")).toBe("allow");
  });

  it("is idempotent for same user", () => {
    expect(canClaimSession("user-a", "user-a")).toBe("already_owned");
  });

  it("denies hijack when owned by another user", () => {
    expect(canClaimSession("user-b", "user-a")).toBe("deny");
  });
});
