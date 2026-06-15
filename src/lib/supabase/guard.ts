import { NextResponse } from "next/server";
import { serviceUnavailable } from "@/lib/api/errors";
import {
  isSupabaseConfigured,
  SUPABASE_ENV_HINT,
} from "@/lib/supabase/config";

/** Standard 503 when Supabase env is missing — use at the top of auth routes. */
export function supabaseNotConfiguredResponse(): NextResponse {
  return serviceUnavailable(`Supabase is not configured. ${SUPABASE_ENV_HINT}`);
}

export function assertSupabaseConfigured(): NextResponse | null {
  if (isSupabaseConfigured()) return null;
  return supabaseNotConfiguredResponse();
}
