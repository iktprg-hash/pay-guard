import { respondWithError } from "@/lib/errors";
import {
  isSupabaseConfigured,
  SUPABASE_ENV_HINT,
} from "@/lib/supabase/config";

/** Standard 503 when Supabase env is missing — use at the top of auth routes. */
export function supabaseNotConfiguredResponse() {
  return respondWithError("SERVICE_UNAVAILABLE", {
    message: `Supabase is not configured. ${SUPABASE_ENV_HINT}`,
  });
}

export function assertSupabaseConfigured(): Response | null {
  if (isSupabaseConfigured()) return null;
  return supabaseNotConfiguredResponse();
}
