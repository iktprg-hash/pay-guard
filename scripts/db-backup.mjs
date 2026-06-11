#!/usr/bin/env node
/**
 * Pay Guard — lokální záloha dat Supabase (pouze disk počítače).
 *
 * Záloha se NIKAM nenahrává — žádný GitHub, Supabase Storage ani jiná cloud služba.
 * Výchozí složka: ~/PayGuard-backups/
 *
 * Usage:
 *   npm run db:backup
 *   npm run db:backup -- --retain=30
 *
 * Volitelně v .env.local:
 *   BACKUP_DIR=/cesta/k/zálohám
 *   BACKUP_RETAIN_DAYS=30
 */

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  databaseUrlHint,
  getProjectRef,
  loadEnvLocal,
} from "./load-env-local.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

loadEnvLocal(root);

const TABLES = [
  "profiles",
  "financial_sessions",
  "debts",
  "chat_messages",
];

const DEFAULT_BACKUP_DIR = join(homedir(), "PayGuard-backups");

const retainDays = parseInt(
  process.env.BACKUP_RETAIN_DAYS ??
    process.argv.find((a) => a.startsWith("--retain="))?.split("=")[1] ??
    "30",
  10
);

function env(name) {
  return (process.env[name] ?? "").replace(/^["']|["']$/g, "").trim();
}

function backupBaseDir() {
  return env("BACKUP_DIR") || DEFAULT_BACKUP_DIR;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function connectPg() {
  const url = env("DATABASE_URL");
  if (!url) return null;

  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString: url,
    ssl:
      url.includes("localhost") || url.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: true },
  });

  try {
    await client.connect();
    return client;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `⚠️  Postgres (${msg}) — použije se Supabase API místo DATABASE_URL`
    );
    return null;
  }
}

async function exportTablesViaSupabase() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    console.error(`
❌ Chybí připojení k databázi (data se stáhnou jen do lokální složky).

Varianta A — DATABASE_URL:
  Supabase → Settings → Database → Connection string → URI (port 6543)
  ${databaseUrlHint(getProjectRef()) ?? "DATABASE_URL=postgresql://..."}

Varianta B — service role (bez DATABASE_URL):
  NEXT_PUBLIC_SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY v .env.local
`);
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const data = {};
  const counts = {};
  const pageSize = 1000;

  async function fetchTable(table, orderCol) {
    const rows = [];
    let from = 0;

    while (true) {
      const { data: page, error } = await supabase
        .from(table)
        .select("*")
        .order(orderCol, { ascending: true, nullsFirst: false })
        .range(from, from + pageSize - 1);

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          return [];
        }
        const msg = error.message ?? String(error);
        if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
          throw new Error(
            `${table}: nelze se připojit k Supabase — zkontrolujte internet`
          );
        }
        throw new Error(`${table}: ${msg}`);
      }

      if (!page?.length) break;
      rows.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  }

  for (const table of TABLES) {
    const order =
      table === "profiles"
        ? "created_at"
        : table === "debts"
          ? "updated_at"
          : "created_at";

    data[table] = await fetchTable(table, order);
    counts[table] = data[table].length;
  }

  return { data, counts, method: "supabase-api" };
}

async function exportTables(client) {
  const data = {};
  const counts = {};

  for (const table of TABLES) {
    const exists = await client.query(
      `SELECT to_regclass($1) AS reg`,
      [`public.${table}`]
    );
    if (!exists.rows[0]?.reg) {
      counts[table] = 0;
      data[table] = [];
      continue;
    }

    const order =
      table === "profiles"
        ? "created_at"
        : table === "debts"
          ? "updated_at"
          : "created_at";

    const res = await client.query(
      `SELECT * FROM public.${table} ORDER BY ${order} ASC NULLS LAST`
    );
    data[table] = res.rows;
    counts[table] = res.rows.length;
  }

  return { data, counts, method: "postgres" };
}

function writeBackupDir(slug, payload, baseDir) {
  const dir = join(baseDir, `pay-guard-${slug}`);
  mkdirSync(dir, { recursive: true });

  for (const table of TABLES) {
    writeFileSync(
      join(dir, `${table}.json`),
      JSON.stringify(payload.data[table], null, 2),
      "utf8"
    );
  }

  const manifest = {
    app: "pay-guard",
    createdAt: new Date().toISOString(),
    projectRef: getProjectRef(),
    exportMethod: payload.method ?? "postgres",
    storage: "local-disk-only",
    backupDir: baseDir,
    tables: payload.counts,
    totalRows: Object.values(payload.counts).reduce((a, b) => a + b, 0),
    note: "Lokální záloha — necommitujte, nenahrávejte do cloudu. Obsahuje PII.",
  };

  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  return { dir, manifest };
}

async function createArchive(sourceDir, slug) {
  const bundle = {
    manifest: JSON.parse(readFileSync(join(sourceDir, "manifest.json"), "utf8")),
  };
  for (const table of TABLES) {
    bundle[table] = JSON.parse(
      readFileSync(join(sourceDir, `${table}.json`), "utf8")
    );
  }

  const archivePath = join(sourceDir, `pay-guard-${slug}.json.gz`);
  const json = JSON.stringify(bundle);
  await pipeline(Readable.from(json), createGzip(), createWriteStream(archivePath));
  return archivePath;
}

function pruneOldBackups(baseDir, days) {
  if (!existsSync(baseDir)) return;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(baseDir)) {
    if (!name.startsWith("pay-guard-")) continue;
    const full = join(baseDir, name);
    try {
      const mtime = statSync(full).mtimeMs;
      if (mtime < cutoff) {
        rmSync(full, { recursive: true, force: true });
        console.log(`🗑  Smazána stará záloha: ${name}`);
      }
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const slug = timestampSlug();
  const baseDir = backupBaseDir();

  console.log(`📦 Pay Guard backup — ${slug}`);
  console.log(`📁 Pouze lokální disk: ${baseDir}\n`);

  let payload;
  const pgClient = await connectPg();

  if (pgClient) {
    console.log("ℹ️  Stažení dat: DATABASE_URL (Postgres)\n");
    try {
      payload = await exportTables(pgClient);
    } finally {
      await pgClient.end();
    }
  } else {
    console.log("ℹ️  Stažení dat: Supabase API → zápis na disk\n");
    payload = await exportTablesViaSupabase();
  }

  mkdirSync(baseDir, { recursive: true });

  const { dir, manifest } = writeBackupDir(slug, payload, baseDir);
  console.log(`✓ Záloha uložena: ${dir}`);
  for (const [table, count] of Object.entries(manifest.tables)) {
    console.log(`   ${table}: ${count} řádků`);
  }

  const archivePath = await createArchive(dir, slug);
  const hash = createHash("sha256")
    .update(readFileSync(archivePath))
    .digest("hex")
    .slice(0, 16);
  writeFileSync(
    join(dir, "checksum.txt"),
    `sha256:${hash}\nfile:${archivePath.split("/").pop()}\n`
  );
  console.log(`✓ Archiv: ${archivePath}`);

  if (Number.isFinite(retainDays) && retainDays > 0) {
    pruneOldBackups(baseDir, retainDays);
  }

  console.log(
    "\nHotovo. Záloha zůstává jen na tomto počítači — GitHub a cloud k ní nemají přístup."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
