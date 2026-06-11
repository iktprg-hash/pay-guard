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
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

async function applyViaManagementApi(file, sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;

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

async function applyViaPg(file, sql) {
  const url = process.env.DATABASE_URL;
  if (!url) return false;

  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString: url,
    ssl: pgSslConfig(url),
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`✓ ${file} (DATABASE_URL)`);
  } finally {
    await client.end();
  }
  return true;
}

async function main() {
  const only = process.argv[2]; // e.g. 003
  const files = listMigrations().filter((f) => !only || f.startsWith(only));

  if (files.length === 0) {
    console.error("No migration files found.");
    process.exit(1);
  }

  const hasDb = Boolean(process.env.DATABASE_URL);
  const hasToken = Boolean(process.env.SUPABASE_ACCESS_TOKEN);

  if (!hasDb && !hasToken) {
    const hint = databaseUrlHint(ref);
    console.error(`
Need DATABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local

Quick fix — add to .env.local (replace [DB_PASSWORD]):

DATABASE_URL=${hint ?? "postgresql://postgres.[ref]:[PASSWORD]@....pooler.supabase.com:6543/postgres"}

Password: Supabase Dashboard → Project Settings → Database → Database password
Copy URI: Connection string → Session pooler → port 6543

Or run: npm run db:hint

Alternative: paste supabase/migrations/006_protect_subscription_tier.sql in SQL Editor → Run
   https://supabase.com/dashboard/project/${ref ?? "YOUR_REF"}/sql/new
`);
    process.exit(1);
  }

  console.log(`Applying ${files.length} migration(s) to project ${ref ?? "?"}…\n`);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const ok =
      (await applyViaPg(file, sql)) || (await applyViaManagementApi(file, sql));
    if (!ok) {
      console.error(`Failed to apply ${file}`);
      process.exit(1);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
