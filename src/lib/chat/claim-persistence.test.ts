import { describe, expect, it, vi, beforeEach } from "vitest";

const validateSessionToken = vi.fn();
const requireServiceClient = vi.fn();

vi.mock("@/lib/security/session", () => ({
  validateSessionToken: (...args: unknown[]) => validateSessionToken(...args),
}));

vi.mock("@/lib/supabase/service-health", () => ({
  requireServiceClient: () => requireServiceClient(),
}));

function mockAdmin(state: {
  userId: string | null;
  updateOk?: boolean;
  messagesOk?: boolean;
}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: state.userId === undefined ? null : { user_id: state.userId },
      error: null,
    }),
    update: vi.fn().mockReturnThis(),
  };

  chain.maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({
      data: state.userId === undefined ? null : { user_id: state.userId },
      error: null,
    })
    .mockResolvedValueOnce({
      data: state.updateOk === false ? null : { id: "sess-1" },
      error: state.updateOk === false ? { message: "fail" } : null,
    });

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "financial_sessions") return chain;
      if (table === "chat_messages") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: state.messagesOk === false ? { message: "fail" } : null,
            }),
          }),
        };
      }
      return chain;
    }),
  };

  requireServiceClient.mockReturnValue(admin);
  return admin;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  validateSessionToken.mockResolvedValue(true);
});

describe("claimSessionForUser", () => {
  it("uses service role after token validation", async () => {
    mockAdmin({ userId: null, updateOk: true });

    const { claimSessionForUser } = await import("@/lib/chat/persistence");
    const ok = await claimSessionForUser("sess-1", "a".repeat(32), "user-a");

    expect(ok).toBe(true);
    expect(validateSessionToken).toHaveBeenCalledWith("sess-1", "a".repeat(32));
    expect(requireServiceClient).toHaveBeenCalled();
  });

  it("rejects invalid token before service role access", async () => {
    validateSessionToken.mockResolvedValue(false);

    const { claimSessionForUser } = await import("@/lib/chat/persistence");
    const ok = await claimSessionForUser("sess-1", "a".repeat(32), "user-a");

    expect(ok).toBe(false);
    expect(requireServiceClient).not.toHaveBeenCalled();
  });

  it("denies claim when session owned by another user", async () => {
    mockAdmin({ userId: "user-b" });

    const { claimSessionForUser } = await import("@/lib/chat/persistence");
    const ok = await claimSessionForUser("sess-1", "a".repeat(32), "user-a");

    expect(ok).toBe(false);
  });

  it("is idempotent for same user", async () => {
    mockAdmin({ userId: "user-a" });

    const { claimSessionForUser } = await import("@/lib/chat/persistence");
    const ok = await claimSessionForUser("sess-1", "a".repeat(32), "user-a");

    expect(ok).toBe(true);
  });
});
