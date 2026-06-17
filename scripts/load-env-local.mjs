import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Load .env.local into process.env (does not override existing vars). */
export function loadEnvLocal(root) {
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let value = m[2];
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[m[1]] = value;
      }
    }
  } catch {
    // .env.local optional
  }
}

export function getProjectRef() {
  return (
    process.env.SUPABASE_PROJECT_REF ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
      /https:\/\/([^.]+)\.supabase\.co/
    )?.[1] ??
    null
  );
}

export function databaseUrlHint(ref) {
  if (!ref) return null;
  return `postgresql://postgres.${ref}:[DB_PASSWORD]@[COPY_POOLER_HOST_FROM_DASHBOARD]:6543/postgres`;
}
