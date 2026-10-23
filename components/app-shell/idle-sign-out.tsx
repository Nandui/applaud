"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { IDLE_TIMEOUT_SECONDS } from "@/lib/auth/idle";

const IDLE_MS = IDLE_TIMEOUT_SECONDS * 1000;
// Shared by every open tab, so using Yayup in one keeps the others signed in.
const STORAGE_KEY = "yayup:last-activity";
// Reading or scrolling makes no requests, so activity renews the session
// cookie itself, at most this often.
const KEEPALIVE_MS = 60 * 1000;
const CHECK_MS = 30 * 1000;
const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "wheel"] as const;

function readShared(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeShared(at: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Private mode etc.: this tab still times out on its own activity.
  }
}

/**
 * Signs the person out after IDLE_TIMEOUT_MINUTES without touching the app in
 * any tab, and sends them to the sign-in page with a note saying why. The
 * server enforces the same limit on the session cookie (auth.config.ts); this
 * clears the screen instead of waiting for the next click.
 */
export function IdleSignOut() {
  useEffect(() => {
    let lastActivity = Date.now();
    let lastKeepalive = Date.now();
    let signingOut = false;
    writeShared(lastActivity);

    function onActivity() {
      // Coming back to a tab that has sat idle past the limit signs out
      // rather than counting as activity.
      check();
      if (signingOut) return;
      const now = Date.now();
      // Scroll and wheel fire constantly; one write a second is plenty.
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      writeShared(now);
      if (now - lastKeepalive >= KEEPALIVE_MS) {
        lastKeepalive = now;
        // Auth.js re-issues the session cookie with a fresh expiry.
        void fetch("/api/auth/session", { cache: "no-store" }).catch(() => {});
      }
    }

    function check() {
      if (signingOut) return;
      const last = Math.max(lastActivity, readShared());
      if (Date.now() - last < IDLE_MS) return;
      signingOut = true;
      const here = window.location.pathname + window.location.search;
      const params = new URLSearchParams({ error: "Idle" });
      if (here !== "/") params.set("callbackUrl", here);
      void signOut({ redirectTo: `/sign-in?${params}` });
    }

    for (const e of EVENTS) {
      window.addEventListener(e, onActivity, { passive: true, capture: true });
    }
    // Background tabs throttle timers, so also check when one comes back.
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, CHECK_MS);

    return () => {
      for (const e of EVENTS) {
        window.removeEventListener(e, onActivity, { capture: true });
      }
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
