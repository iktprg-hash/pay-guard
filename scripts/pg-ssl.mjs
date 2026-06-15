/** SSL options for Supabase / remote Postgres in Node scripts. */
export function pgSslConfig(connectionString) {
  if (
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")
  ) {
    return false;
  }
  // Some networks / Node builds reject Supabase pooler chain ("self-signed certificate").
  // Dev-only escape hatch: DATABASE_SSL_NO_VERIFY=1 npm run db:apply
  if (process.env.DATABASE_SSL_NO_VERIFY === "1") {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}
