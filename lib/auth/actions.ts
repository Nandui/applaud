"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { devSignInEnabled } from "@/lib/auth/mode";

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
