#!/usr/bin/env node
/**
 * Compare local supabase/migrations with remote schema_migrations registry.
 * Helps resolve: "Remote migration versions not found in local migrations directory."
 *
 * Usage:
 *   npm run db:migration-audit
 *   DATABASE_URL=postgresql://... npm run db:migration-audit
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getProjectRef, loadEnvLocal } from "./load-env-local.mjs";
import { pgSslConfig } from "./pg-ssl.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

function listLocal() {
  return readdirSync(join(root, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();
}

async function listRemote() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || url.includes("[PASSWORD]") || url.includes("PASTE_")) {
    return null;
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url, ssl: pgSslConfig(url) });
  await client.connect();
  try {
    const { rows } = await client.query(
      "select version from supabase_migrations.schema_migrations order by version"
    );
    return rows.map((r) => r.version);
  } finally {
    await client.end();
  }
}

function printSection(title) {
  console.log(`\n── ${title} ──`);
}

async function main() {
  const ref = getProjectRef();
  const local = listLocal();

  console.log(`
╔══════════════════════════════════════════════════╗
║  Pay Guard — migration registry audit            ║
╚══════════════════════════════════════════════════╝
`);

  printSection(`Local files (${local.length})`);
  for (const v of local) console.log(`  ${v}`);

  const remote = await listRemote();

  if (!remote) {
    printSection("Remote registry");
    console.log("  (skipped — set DATABASE_URL in .env.local)");
    console.log(`
Run in Supabase SQL Editor:
  SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;

Dashboard: https://supabase.com/dashboard/project/${ref ?? "YOUR_REF"}/sql/new

Pay Guard applies migrations via SQL Editor / npm run db:apply — not supabase db push.
If npm run db:verify passes, your schema is OK; this CLI warning is registry-only.
`);
    process.exit(0);
  }

  printSection(`Remote registry (${remote.length})`);
  for (const v of remote) {
    const ok = local.includes(v);
    console.log(`  ${ok ? "✅" : "❌"} ${v}`);
  }

  const orphanRemote = remote.filter((v) => !local.includes(v));
  const missingRemote = local.filter((v) => !remote.includes(v));

  if (orphanRemote.length) {
    printSection("Orphan remote → causes Supabase CLI error");
    for (const v of orphanRemote) console.log(`  ${v}`);
    console.log(`
Fix (Supabase CLI linked to project ${ref ?? "?"}):
${orphanRemote.map((v) => `  supabase migration repair --status reverted ${v}`).join("\n")}
`);
  }

  if (missingRemote.length) {
    printSection("Local not registered remotely (often OK if applied manually)");
    for (const v of missingRemote) console.log(`  ${v}`);
    console.log(`
If schema already applied via SQL Editor, register versions:
${missingRemote.map((v) => `  supabase migration repair --status applied ${v}`).join("\n")}
`);
  }

  if (!orphanRemote.length && !missingRemote.length) {
    console.log("\n✅ Local migration files match remote registry.");
  }

  console.log(`
Schema check (recommended): npm run db:verify
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
