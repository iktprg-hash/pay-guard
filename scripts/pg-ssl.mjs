/** SSL options for Supabase / remote Postgres in Node scripts. */
export function pgSslConfig(connectionString) {
  if (
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")
  ) {
    return false;
  }

  // Force strict verify: DATABASE_SSL_NO_VERIFY=0
  if (process.env.DATABASE_SSL_NO_VERIFY === "0") {
    return { rejectUnauthorized: true };
  }

  // Supabase pooler often fails Node TLS verify ("self-signed certificate in chain").
  // Default to relaxed verify for Supabase hosts in local tooling scripts.
  if (
    process.env.DATABASE_SSL_NO_VERIFY === "1" ||
    connectionString.includes("supabase.com") ||
    connectionString.includes("supabase.co")
  ) {
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}
