/**
 * Throwaway "brand-new person" accounts for trying the first-sign-in
 * experience (app tour, welcome points, birthday step) during development.
 *
 * They are only ever created from the dev login, which production never
 * offers (lib/auth/mode.ts), and they use a reserved test domain that no real
 * Google account can have, so they can't be confused with staff. Admin > Users
 * marks them "Test" and removes them all in one go.
 */
export const TEST_EMAIL_DOMAIN = "yayup.test";

export function isTestEmail(email: string | null | undefined): boolean {
  return String(email ?? "").trim().toLowerCase().endsWith(`@${TEST_EMAIL_DOMAIN}`);
}

/** A fresh, unique address and name for a new test account. */
export function newTestIdentity(random: string = randomTag()): { email: string; name: string } {
  const tag = random.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "x";
  return {
    email: `newcomer-${tag}@${TEST_EMAIL_DOMAIN}`,
    name: `Newcomer Test ${tag.toUpperCase()}`,
  };
}

function randomTag(): string {
  return Math.random().toString(36).slice(2, 8);
}
