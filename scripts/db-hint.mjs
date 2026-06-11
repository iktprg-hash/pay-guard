#!/usr/bin/env node
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  databaseUrlHint,
  getProjectRef,
  loadEnvLocal,
} from "./load-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal(root);

const ref = getProjectRef();
const hint = databaseUrlHint(ref);
const hasDb = Boolean(process.env.DATABASE_URL);
const hasToken = Boolean(process.env.SUPABASE_ACCESS_TOKEN);
const migrations = readdirSync(join(root, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`
Pay Guard — миграции Supabase (001–004)
${"─".repeat(44)}

Проект: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "не найден в .env.local"}
Ref:    ${ref ?? "?"}

Файлы:
${migrations.map((f) => `  • supabase/migrations/${f}`).join("\n")}

Проверка без DATABASE_URL:
  npm run db:verify

Статус credentials:
  DATABASE_URL            ${hasDb ? "✓ задан" : "✗ не задан"}
  SUPABASE_ACCESS_TOKEN   ${hasToken ? "✓ задан" : "✗ не задан"}

─── Способ A (проще): SQL Editor ───
1. https://supabase.com/dashboard/project/${ref ?? "YOUR_REF"}/sql/new
2. По очереди вставьте и Run каждый файл из supabase/migrations/
3. npm run db:verify

─── Способ B: через терминал (все миграции) ───
1. Dashboard → Project Settings → Database → Database password
2. Connection string → URI → "Session pooler" → порт 6543
3. Добавьте в .env.local:

DATABASE_URL=${hint ?? "postgresql://postgres.[ref]:[PASSWORD]@....pooler.supabase.com:6543/postgres"}

4. npm run db:apply

─── Способ C: Management API token ───
1. https://supabase.com/dashboard/account/tokens → Generate
2. В .env.local: SUPABASE_ACCESS_TOKEN=sbp_...
3. npm run db:apply
`);
