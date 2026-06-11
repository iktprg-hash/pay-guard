import { describe, expect, it, vi, beforeEach } from "vitest";

const getServerUser = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/lib/auth/session", () => ({
  getServerUser: () => getServerUser(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

describe("server-page-guard", () => {
  beforeEach(() => {
    getServerUser.mockReset();
    redirect.mockClear();
  });

  it("requirePageUser redirects to login when unauthenticated", async () => {
    getServerUser.mockResolvedValue(null);
    const { requirePageUser } = await import("@/lib/auth/server-page-guard");

    await expect(requirePageUser("cs")).rejects.toThrow("REDIRECT:/cs/login");
  });

  it("requirePageUser passes when authenticated", async () => {
    getServerUser.mockResolvedValue({ id: "u1" });
    const { requirePageUser } = await import("@/lib/auth/server-page-guard");

    await expect(requirePageUser("cs")).resolves.toBeUndefined();
  });

  it("redirectIfAuthenticated sends authed users home", async () => {
    getServerUser.mockResolvedValue({ id: "u1" });
    const { redirectIfAuthenticated } = await import(
      "@/lib/auth/server-page-guard"
    );

    await expect(redirectIfAuthenticated("ru")).rejects.toThrow(
      "REDIRECT:/ru"
    );
  });
});
