import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Integration contract: migration 002 RLS + claimSessionForUser must use service role.
 * Supabase live DB not required — verifies SQL policy intent and server code alignment.
 */
describe("claim + migration 002 RLS integration", () => {
  const migration002 = readFileSync(
    join(process.cwd(), "supabase/migrations/002_session_token.sql"),
    "utf8"
  );
  const persistenceSource = readFileSync(
    join(process.cwd(), "src/lib/chat/persistence.ts"),
    "utf8"
  );
  const claimRouteSource = readFileSync(
    join(process.cwd(), "src/app/api/session/claim/route.ts"),
    "utf8"
  );

  it("migration 002 removes open anonymous RLS policies", () => {
    expect(migration002).toContain(
      'drop policy if exists "Users can view own sessions"'
    );
    expect(migration002).toContain(
      'create policy "Authenticated users view own sessions"'
    );
    expect(migration002).toContain("using (auth.uid() = user_id)");
    expect(migration002).toContain(
      "Anonymní relace: přístup pouze přes service role"
    );
  });

  it("migration 002 does not grant SELECT on user_id IS NULL to authenticated users", () => {
    expect(migration002).not.toMatch(
      /user_id is null or auth\.uid\(\) = user_id/
    );
  });

  it("claimSessionForUser uses service role, not user-scoped client param", () => {
    expect(persistenceSource).toContain("requireServiceClient()");
    expect(persistenceSource).toMatch(
      /export async function claimSessionForUser\(\s*sessionId: string,\s*sessionToken: string,\s*userId: string/
    );
    expect(persistenceSource).not.toMatch(
      /claimSessionForUser\(\s*supabase: SupabaseClient/
    );

    const claimFn = persistenceSource.slice(
      persistenceSource.indexOf("export async function claimSessionForUser"),
      persistenceSource.indexOf("export async function createUserSession")
    );
    expect(claimFn).toContain("validateSessionToken");
    expect(claimFn).toContain("const admin = requireServiceClient()");
    expect(claimFn).toContain('.is("user_id", null)');
    expect(claimFn).toContain("assignDebtsToUser");
  });

  it("claim API route delegates without importing user createClient", () => {
    expect(claimRouteSource).toContain("claimSessionForUser(");
    expect(claimRouteSource).not.toContain("createClient");
    expect(claimRouteSource).not.toContain("from \"@/lib/supabase/server\"");
  });
});
