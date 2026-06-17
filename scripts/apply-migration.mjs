#!/usr/bin/env node
/**
 * Apply pending SQL migrations via DATABASE_URL or Supabase Management API.
 *
 * Option A — direct Postgres (recommended):
 *   DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@....pooler.supabase.com:6543/postgres" \
 *     npm run db:apply
 *
 * Option B — Management API:
 *   SUPABASE_ACCESS_TOKEN=sbp_... npm run db:apply
 *
 * Option C — SQL Editor (no credentials):
 *   npm run db:sql -- 011
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  databaseUrlAlternates,
  isPoolerTenantError,
  maskDatabaseUrl,
} from "./database-url-alternates.mjs";
import {
  databaseUrlHint,
  getProjectRef,
  loadEnvLocal,
} from "./load-env-local.mjs";
import { pgSslConfig } from "./pg-ssl.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

loadEnvLocal(root);
const ref = getProjectRef();

function listMigrations() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function sqlEditorUrl() {
  return `https://supabase.com/dashboard/project/${ref ?? "YOUR_REF"}/sql/new`;
}

function printSqlEditorHelp(files) {
  console.error(`
Could not apply migration via DATABASE_URL.

Common cause: wrong pooler region in DATABASE_URL
  → "tenant/user postgres.${ref ?? "YOUR_REF"} not found"

Fix (pick one):

1) SQL Editor (fastest — copy SQL below, paste, Run):
   ${sqlEditorUrl()}

2) Copy exact URI from Dashboard (do NOT use a hardcoded region):
   Project Settings → Database → Connection string → URI → Session pooler (6543)
   Replace DATABASE_URL in .env.local, then: npm run db:apply:011

3) Management API token (no DATABASE_URL):
   https://supabase.com/dashboard/account/tokens
   SUPABASE_ACCESS_TOKEN=sbp_... in .env.local → npm run db:apply:011
`);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.error(`\n--- ${file} ---\n${sql}`);
  }
}

async function applyViaManagementApi(file, sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || !ref) return false;

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Management API (${file}): ${res.status} ${body}`);
  }

  console.log(`✓ ${file} (Management API)`);
  return true;
}

async function runSqlOnUrl(connectionString, sql) {
  const { default: pg } = await import("pg");

  async function connectAndRun(ssl) {
    const client = new pg.Client({
      connectionString,
      ssl,
    });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  }

  const ssl = pgSslConfig(connectionString);
  try {
    await connectAndRun(ssl);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : null;
    if (
      code === "SELF_SIGNED_CERT_IN_CHAIN" &&
      ssl !== false &&
      ssl?.rejectUnauthorized !== false
    ) {
      await connectAndRun({ rejectUnauthorized: false });
      return;
    }
    throw err;
  }
}

async function applyViaPg(file, sql) {
  const baseUrl = process.env.DATABASE_URL?.trim();
  if (!baseUrl) return false;

  const candidates = databaseUrlAlternates(baseUrl, ref);
  let lastError;

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];
    const label =
      index === 0 ? "DATABASE_URL" : `alternate #${index} (${maskDatabaseUrl(url)})`;

    try {
      await runSqlOnUrl(url, sql);
      console.log(`✓ ${file} (${label})`);
      return true;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (index < candidates.length - 1) {
        console.warn(`⚠ ${file}: ${label} failed (${msg}) — trying next URL…`);
      }
    }
  }

  throw lastError ?? new Error("DATABASE_URL connection failed");
}

async function applyMigrationFile(file, sql, { hasDb, hasToken }) {
  if (hasToken) {
    try {
      if (await applyViaManagementApi(file, sql)) return true;
    } catch (err) {
      console.warn(
        `⚠ ${file}: Management API failed (${err instanceof Error ? err.message : err})`
      );
    }
  }

  if (hasDb) {
    try {
      return await applyViaPg(file, sql);
    } catch (err) {
      if (hasToken) {
        console.warn(
          `⚠ ${file}: DATABASE_URL failed (${err instanceof Error ? err.message : err}) — retrying Management API…`
        );
        return applyViaManagementApi(file, sql);
      }
      throw err;
    }
  }

  return false;
}

async function main() {
  const only = process.argv[2]; // e.g. 003
  const files = listMigrations().filter((f) => !only || f.startsWith(only));

  if (files.length === 0) {
    console.error("No migration files found.");
    process.exit(1);
  }

  const hasDb = Boolean(process.env.DATABASE_URL?.trim());
  const hasToken = Boolean(process.env.SUPABASE_ACCESS_TOKEN);

  if (!hasDb && !hasToken) {
    const hint = databaseUrlHint(ref);
    const sqlFile =
      only && files[0]
        ? `supabase/migrations/${files[0]}`
        : "supabase/migrations/008_stripe_billing.sql";
    console.error(`
Need DATABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local

Quick fix — add to .env.local (replace [DB_PASSWORD], copy host from Dashboard):

DATABASE_URL=${hint ?? "postgresql://postgres.[ref]:[PASSWORD]@....pooler.supabase.com:6543/postgres"}

Password: Supabase Dashboard → Project Settings → Database → Database password
Copy URI: Connection string → Session pooler → port 6543 (region must match your project)

Or run: npm run db:hint

Alternative: SQL Editor:
   ${sqlEditorUrl()}
   File: ${sqlFile}
`);
    process.exit(1);
  }

  console.log(`Applying ${files.length} migration(s) to project ${ref ?? "?"}…\n`);

  try {
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      const ok = await applyMigrationFile(file, sql, { hasDb, hasToken });
      if (!ok) {
        console.error(`Failed to apply ${file}`);
        process.exit(1);
      }
    }
  } catch (err) {
    if (isPoolerTenantError(err) || !hasToken) {
      printSqlEditorHelp(files);
    }
    throw err;
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
