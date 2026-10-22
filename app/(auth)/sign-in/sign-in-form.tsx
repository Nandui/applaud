"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  LogIn,
  ShieldCheck,
  UserCog,
  Crown,
  Wrench,
  User as UserIcon,
} from "lucide-react";
import {
  authenticate,
  googleSignIn,
  quickSignIn,
  type AuthState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Sample = {
  name: string;
  email: string;
  role: string;
  jobTitle: string | null;
};

const ROLE_ICON: Record<string, typeof UserIcon> = {
  admin: ShieldCheck,
  manager: UserCog,
  staff: UserIcon,
  operations: Wrench,
  ceo: Crown,
};

export function SignInForm({
  samples,
  google,
  dev,
  callbackUrl,
  error,
}: {
  samples: Sample[];
  /** Offer "Continue with Google" (the real sign-in). */
  google: boolean;
  /** Offer the passwordless dev login (never on production). */
  dev: boolean;
  callbackUrl?: string;
  error?: string;
}) {
  return (
    <div className="space-y-5 px-6 pt-7 pb-8">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-extrabold">Welcome back</h2>
        <p className="text-muted text-sm">
          {google ? "Sign in with your work Google account." : "Enter your work email to continue."}
        </p>
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {google ? (
        <form action={googleSignIn}>
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
          <GoogleButton />
        </form>
      ) : null}
      {!google && !dev ? (
        <p className="text-muted text-sm">
          Sign-in isn&apos;t set up yet. An admin needs to add the Google sign-in keys.
        </p>
      ) : null}
      {dev ? <DevSignIn samples={samples} divider={google} /> : null}
    </div>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-surface-2 active:bg-surface-3 flex h-13 w-full items-center justify-center gap-3 rounded-full text-base font-extrabold transition-colors disabled:opacity-60"
    >
      <GoogleLogo className="size-5" />
      {pending ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Passwordless dev login: local dev and protected preview deployments only. */
function DevSignIn({ samples, divider }: { samples: Sample[]; divider: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    authenticate,
    undefined,
  );

  return (
    <div className="space-y-5">
      {divider ? (
        <div className="flex items-center gap-3">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted text-xs whitespace-nowrap">or dev login (no password)</span>
          <div className="bg-border h-px flex-1" />
        </div>
      ) : null}
      <div className="space-y-5">
        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="sr-only">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              required
              className="bg-surface-2 h-13 rounded-2xl border-0 px-4 text-base"
            />
          </div>
          {state?.error ? (
            <p className="text-danger text-sm">{state.error}</p>
          ) : null}
          <Button type="submit" className="bg-primary text-primary-fg hover:bg-primary/90 h-13 w-full rounded-full text-base font-extrabold" disabled={pending}>
            <LogIn className="size-4" />
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {samples.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-border h-px flex-1" />
              <span className="text-muted text-xs whitespace-nowrap">
                or quick-switch role (dev)
              </span>
              <div className="bg-border h-px flex-1" />
            </div>
            <div className="grid gap-2">
              {samples.map((s) => {
                const Icon = ROLE_ICON[s.role] ?? UserIcon;
                return (
                  <form key={s.email} action={quickSignIn}>
                    <input type="hidden" name="email" value={s.email} />
                    <button
                      type="submit"
                      className="bg-surface-2 active:bg-surface-3 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors"
                    >
                      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {s.name}
                        </span>
                        <span className="text-muted block truncate text-xs">
                          {s.jobTitle ?? s.email}
                        </span>
                      </span>
                      <Badge variant="secondary" className="capitalize">
                        {s.role}
                      </Badge>
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
