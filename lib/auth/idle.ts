/**
 * Everyone is signed out after this long without using Yayup.
 *
 * Enforced twice: the session cookie lives this long and is renewed by every
 * request through the proxy (auth.config.ts), so a stale tab is signed out on
 * its next click; and IdleSignOut signs an open tab out on the spot once
 * nobody has touched it for this long, in any tab.
 */
export const IDLE_TIMEOUT_MINUTES = 30;
export const IDLE_TIMEOUT_SECONDS = IDLE_TIMEOUT_MINUTES * 60;
