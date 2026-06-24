import type { SessionUser } from "./types";

/**
 * Returns the signed-in user, or null when signed out.
 *
 * Phase 0 stub: returns null (the shell renders a signed-out state).
 * Phase 2 replaces the body with next-auth's `auth()` session read.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return null;
}
