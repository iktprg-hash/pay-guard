#!/usr/bin/env node
/** Detect corrupted Turbopack dev cache (prerender-manifest.json → HTTP 500). */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, ".next", "dev", "prerender-manifest.json");

export function isDevCacheCorrupt() {
  if (!existsSync(manifestPath)) return false;
  try {
    JSON.parse(readFileSync(manifestPath, "utf8"));
    return false;
  } catch {
    return true;
  }
}

export function devCacheFixHint() {
  return "npm run dev:restart   # or: npm run dev:clean";
}

if (process.argv[1]?.endsWith("check-dev-cache.mjs")) {
  if (isDevCacheCorrupt()) {
    console.error(
      `Corrupted dev cache: ${manifestPath}\nFix: ${devCacheFixHint()}`
    );
    process.exit(1);
  }
  process.exit(0);
}
