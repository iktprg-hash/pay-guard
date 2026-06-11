import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { emitRecommendationSaved, PWA_RECOMMENDATION_SAVED } from "@/lib/pwa/events";

describe("pwa events", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emits recommendation saved custom event", () => {
    emitRecommendationSaved();
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
    const event = vi.mocked(window.dispatchEvent).mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(PWA_RECOMMENDATION_SAVED);
  });
});
