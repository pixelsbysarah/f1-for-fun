import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Root middleware. Delegates to `updateSession` to refresh the Supabase
 * session cookie and guard protected routes on every matching request.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Run on all paths except Next.js internals and static assets. Auth cookies
   * still need refreshing on public pages (the dashboard reads predictions),
   * so we intentionally do NOT exclude "/" here.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
