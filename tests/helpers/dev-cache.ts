import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const manifestPath = join(
  process.cwd(),
  ".next",
  "dev",
  "prerender-manifest.json"
);

/** Detect corrupted Turbopack dev cache (prerender-manifest.json → HTTP 404/500). */
export function isDevCacheCorrupt(): boolean {
  if (!existsSync(manifestPath)) return false;
  try {
    JSON.parse(readFileSync(manifestPath, "utf8"));
    return false;
  } catch {
    return true;
  }
}

export const DEV_CACHE_FIX_HINT =
  "npm run dev:restart   # or: npm run dev:clean";
