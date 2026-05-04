import { NextResponse } from "next/server";

/**
 * Keep middleware off Stripe/Phaxio webhook POSTs so nothing can rewrite or 307-redirect
 * them before the route handler runs (signature body must be raw).
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico).*)",
  ],
};
