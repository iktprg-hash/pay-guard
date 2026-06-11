import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration 006 subscription guard", () => {
  const migration006 = readFileSync(
    join(process.cwd(), "supabase/migrations/006_protect_subscription_tier.sql"),
    "utf8"
  );

  it("defines guard trigger on profiles", () => {
    expect(migration006).toContain("guard_profile_subscription_fields");
    expect(migration006).toContain("trg_guard_profile_subscription");
    expect(migration006).toContain("before insert or update on public.profiles");
  });

  it("allows service_role to change subscription fields", () => {
    expect(migration006).toContain("service_role");
    expect(migration006).toContain("new.subscription_tier := old.subscription_tier");
  });

  it("forces free tier on client INSERT", () => {
    expect(migration006).toContain("new.subscription_tier := 'free'");
    expect(migration006).toContain("new.subscription_expires_at := null");
  });
});
