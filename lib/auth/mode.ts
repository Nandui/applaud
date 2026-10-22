/**
 * Which sign-in methods this deployment offers. Plain env reads, safe to
 * import from server components and auth.ts alike.
 *
 * Production signs in with Google Workspace only. The passwordless dev login
 * (any user's email, no password) exists for local dev and preview
 * deployments, which sit behind Vercel Deployment Protection; it is never
 * registered on production, where yayup.app is public.
 */
export const googleSignInEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const devSignInEnabled = process.env.VERCEL_ENV !== "production";

/** Workspace domains allowed to sign in with Google, e.g. "leisureworldcork.com". */
export const googleAllowedDomains = (process.env.AUTH_GOOGLE_DOMAIN ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
