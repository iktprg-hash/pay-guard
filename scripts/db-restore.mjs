#!/usr/bin/env node
/**
 * Pay Guard — dry-run kontrola lokální zálohy (bez zápisu do DB).
 *
 * Usage:
 *   npm run db:restore -- ~/PayGuard-backups/pay-guard-2026-06-11T12-00-00
 *   npm run db:restore -- ~/PayGuard-backups/pay-guard-2026-06-11T12-00-00/pay-guard-2026-06-11T12-00-00.json.gz
 *
 * Skript NIC neimportuje do Supabase — jen ověří archiv a vypíše souhrn.
 * Tabulka auth.users není součástí zálohy (Supabase Auth).
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { homedir } from "node:os";
import { join } from "node:path";

const TABLES = [
  "profiles",
  "financial_sessions",
  "debts",
  "chat_messages",
];

function usage() {
  console.log(`
Pay Guard — kontrola zálohy (dry-run)

  npm run db:restore -- <cesta-k-složce-nebo-.json.gz>

Příklad:
  npm run db:restore -- ~/PayGuard-backups/pay-guard-2026-06-11T12-00-00

Poznámka: auth.users není v záloze — obnovení účtů řešte přes Supabase Auth.
`);
}

function resolvePath(inputPath) {
  if (inputPath.startsWith("~/")) {
    return join(homedir(), inputPath.slice(2));
  }
  if (inputPath === "~") {
    return homedir();
  }
  return inputPath;
}

function loadFromDir(dir) {
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Chybí manifest.json v ${dir}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const data = {};
  for (const table of TABLES) {
    const file = join(dir, `${table}.json`);
    data[table] = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : [];
  }
  return { manifest, data, source: dir };
}

function loadFromGz(path) {
  const bundle = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8"));
  const manifest = bundle.manifest;
  if (!manifest) {
    throw new Error("Archiv neobsahuje manifest");
  }
  const data = {};
  for (const table of TABLES) {
    data[table] = bundle[table] ?? [];
  }
  return { manifest, data, source: path };
}

function loadBackup(inputPath) {
  const stat = statSync(inputPath);
  if (stat.isDirectory()) {
    return loadFromDir(inputPath);
  }
  if (inputPath.endsWith(".json.gz")) {
    return loadFromGz(inputPath);
  }
  throw new Error(`Neznámý formát: ${inputPath}`);
}

function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    usage();
    process.exit(1);
  }

  const resolved = resolvePath(inputPath);

  if (!existsSync(resolved)) {
    console.error(`❌ Cesta neexistuje: ${resolved}`);
    process.exit(1);
  }

  console.log(`🔍 Dry-run kontrola zálohy: ${resolved}\n`);

  const { manifest, data, source } = loadBackup(resolved);

  console.log("Manifest:");
  console.log(`  app: ${manifest.app ?? "?"}`);
  console.log(`  createdAt: ${manifest.createdAt ?? "?"}`);
  console.log(`  exportMethod: ${manifest.exportMethod ?? "?"}`);
  console.log(`  projectRef: ${manifest.projectRef ?? "?"}`);
  console.log(`  storage: ${manifest.storage ?? "?"}`);

  console.log("\nTabulky:");
  let total = 0;
  for (const table of TABLES) {
    const rows = Array.isArray(data[table]) ? data[table].length : 0;
    total += rows;
    console.log(`  ${table}: ${rows} řádků`);
  }
  console.log(`  celkem: ${total} řádků`);

  console.log("\n⚠️  auth.users není součástí zálohy (Supabase Auth).");
  console.log("✓ Dry-run dokončen — do databáze se nic nezapisovalo.");
  console.log(`  zdroj: ${source}`);
}

main();
