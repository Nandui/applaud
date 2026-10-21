"use client";

import { useActionState } from "react";
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

export function SignInForm({ samples }: { samples: Sample[] }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    authenticate,
    undefined,
  );

  return (
    <div className="space-y-5 px-6 pt-7 pb-8">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-extrabold">Welcome back</h2>
        <p className="text-muted text-sm">Enter your work email to continue.</p>
      </div>
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
              placeholder="name@applaud.test"
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
          <Button type="submit" className="bg-lime text-lime-fg hover:bg-lime/90 h-13 w-full rounded-full text-base font-extrabold" disabled={pending}>
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
