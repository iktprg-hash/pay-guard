import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const createServiceClient = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createServiceClient(),
}));

describe("service-health", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
    createServiceClient.mockReturnValue({ from: vi.fn() });
  });

  afterEach(() => {
    process.env = env;
  });

  it("requireServiceClient throws in production when missing", async () => {
    process.env.NODE_ENV = "production";
    createServiceClient.mockReturnValue(null);

    const { requireServiceClient, ServiceRoleMissingError } = await import(
      "@/lib/supabase/service-health"
    );

    expect(() => requireServiceClient()).toThrow(ServiceRoleMissingError);
  });

  it("requireServiceClient returns null in development when missing", async () => {
    process.env.NODE_ENV = "development";
    createServiceClient.mockReturnValue(null);

    const { requireServiceClient } = await import("@/lib/supabase/service-health");
    expect(requireServiceClient()).toBeNull();
  });
});
