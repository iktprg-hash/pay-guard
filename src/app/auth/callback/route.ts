import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy redirect — PKCE exchange probíhá na klientu (/auth/confirm),
 * kde jsou dostupné cookies s code_verifier.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/confirm";
  return NextResponse.redirect(url);
}
