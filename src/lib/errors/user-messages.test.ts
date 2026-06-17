import { describe, expect, it } from "vitest";
import { getUserErrorMessage } from "@/lib/errors/user-messages";

describe("getUserErrorMessage", () => {
  it("returns Czech copy for RATE_LIMITED", () => {
    expect(getUserErrorMessage("RATE_LIMITED", "cs")).toContain("Příliš mnoho");
  });

  it("returns Russian copy for RATE_LIMITED", () => {
    expect(getUserErrorMessage("RATE_LIMITED", "ru")).toContain("Слишком много");
  });

  it("falls back to English for unknown locale edge cases", () => {
    expect(getUserErrorMessage("UNKNOWN_ERROR", "en")).toContain("unexpected");
  });
});
