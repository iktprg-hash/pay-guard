/** SSL options for Supabase / remote Postgres in Node scripts. */
export function pgSslConfig(connectionString) {
  if (
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")
  ) {
    return false;
  }
  return { rejectUnauthorized: true };
}
