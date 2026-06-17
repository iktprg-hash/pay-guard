#!/usr/bin/env node
/** Print migration SQL + SQL Editor link (when DATABASE_URL pooler is misconfigured). */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getProjectRef, loadEnvLocal } from "./load-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);
const ref = getProjectRef();
const only = process.argv[2];
const migrationsDir = join(root, "supabase", "migrations");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .filter((f) => !only || f.startsWith(only));

if (files.length === 0) {
  console.error(`No migration matching "${only ?? ""}"`);
  process.exit(1);
}

console.log(`Open SQL Editor:\nhttps://supabase.com/dashboard/project/${ref ?? "YOUR_REF"}/sql/new\n`);

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  console.log(`--- ${file} ---\n${sql}\n`);
}
