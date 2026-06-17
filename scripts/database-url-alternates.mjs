/**
 * Build DATABASE_URL candidates when pooler host/region is wrong.
 * Supabase pooler: postgres.[ref]@aws-0-[region].pooler.supabase.com:6543
 * Direct:          postgres@db.[ref].supabase.co:5432
 */
export function databaseUrlAlternates(url, ref) {
  if (!url) return [];

  const candidates = [];
  const seen = new Set();
  const add = (value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    candidates.push(value);
  };

  add(url.trim());

  if (!ref) return candidates;

  const poolerMatch = url.trim().match(
    /^postgresql:\/\/postgres\.([^:]+):([^@]+)@([^/]+)\/(.+)$/
  );
  if (poolerMatch) {
    const [, , password, , dbName] = poolerMatch;
    add(`postgresql://postgres:${password}@db.${ref}.supabase.co:5432/${dbName}`);
  }

  const directMatch = url.trim().match(
    /^postgresql:\/\/postgres:([^@]+)@db\.([^.]+)\.supabase\.co:5432\/(.+)$/
  );
  if (directMatch) {
    const [, password, , dbName] = directMatch;
    add(
      `postgresql://postgres.${ref}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/${dbName}`
    );
  }

  return candidates;
}

export function isPoolerTenantError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /tenant\/user\s+postgres\.[^\s]+\s+not found/i.test(msg);
}

export function maskDatabaseUrl(url) {
  return url.replace(/:([^:@/]+)@/, ":***@");
}
