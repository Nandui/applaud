"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { devSignInEnabled } from "@/lib/auth/mode";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { defaultSiteId } from "@/lib/auth/google-account";
import { newTestIdentity } from "@/lib/test-accounts";

export type AuthState = { error?: string } | undefined;

/** Used by the manual email form (with error feedback via useActionState). */
export async function authenticate(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!devSignInEnabled) return { error: "Use Continue with Google." };
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };
  try {
    await signIn("credentials", { email, redirectTo: "/" });
  } catch (error) {
    // A successful sign-in throws a redirect (re-thrown below); only real
    // auth failures are AuthError.
    if (error instanceof AuthError) {
      return { error: "No active account found for that email." };
    }
    throw error;
  }
  return undefined;
}

/** Used by the dev quick-switch buttons (known-good seeded emails). */
export async function quickSignIn(formData: FormData) {
  if (!devSignInEnabled) return;
  const email = String(formData.get("email") ?? "");
  await signIn("credentials", { email, redirectTo: "/" });
}

/**
 * Dev login only (never on production): create a throwaway account that looks
 * exactly like someone signing in with Google for the first time (staff at the
 * busiest site, marked New, no tour, no birthday, no points) and sign in as
 * them, so the whole first-sign-in experience can be tried again and again.
 */
export async function signInAsNewcomer() {
  if (!devSignInEnabled) return;
  const siteId = await defaultSiteId();
  if (!siteId) throw new Error("Add a site in Admin > Sites first.");
  let user: { id: string; email: string; name: string } | null = null;
  for (let attempt = 0; attempt < 3 && !user; attempt++) {
    const { email, name } = newTestIdentity();
    try {
      user = await prisma.user.create({
        data: { email, name, role: "staff", siteId, needsReview: true },
        select: { id: true, email: true, name: true },
      });
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
    }
  }
  if (!user) throw new Error("Couldn't create a test account. Try again.");
  await writeAudit({
    action: "user.test_created",
    entityType: "user",
    entityId: user.id,
    summary: `Created test account ${user.name} to try the first sign-in`,
    metadata: { email: user.email, siteId },
    siteId,
  });
  await signIn("credentials", { email: user.email, redirectTo: "/" });
}

/** Only same-site paths, so `callbackUrl` can't bounce people off-site. */
function safeRedirect(value: FormDataEntryValue | null): string {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

/** The "Continue with Google" button. */
export async function googleSignIn(formData: FormData) {
  await signIn("google", { redirectTo: safeRedirect(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}
