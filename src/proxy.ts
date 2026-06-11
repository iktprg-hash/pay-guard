import { type NextRequest, NextResponse } from "next/server";

/**
 * Thin Edge entry — heavy logic lives in proxy-handler (dynamic import).
 * If the handler bundle fails on Vercel Edge, requests still pass through.
 */
export default async function proxy(request: NextRequest) {
  try {
    const { handleProxy } = await import("./proxy-handler");
    return await handleProxy(request);
  } catch (error) {
    console.error("[proxy] handler failed:", error);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/",
    "/(cs|ru|en)/:path*",
    "/api/((?!health$).*)",
    "/auth/:path*",
  ],
};
