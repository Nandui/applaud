import { handlers } from "@/auth";
import type { NextRequest } from "next/server";
import { completeConsent, statePrefix } from "@/lib/email/oauth";

export const { POST } = handlers;

export function GET(request: NextRequest) {
  // Mail consent uses the client's already registered Google redirect URI.
  if (request.nextUrl.pathname === "/api/auth/callback/google" &&
      request.nextUrl.searchParams.get("state")?.startsWith(statePrefix)) {
    return completeConsent(request);
  }
  return handlers.GET(request);
}
