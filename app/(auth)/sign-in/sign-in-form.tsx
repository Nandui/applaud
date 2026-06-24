"use client";

import { useActionState } from "react";
import { LogIn, ShieldCheck, UserCog, User as UserIcon } from "lucide-react";
import {
  authenticate,
  quickSignIn,
  type AuthState,
} from "@/lib/auth/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
};

export function SignInForm({ samples }: { samples: Sample[] }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    authenticate,
    undefined,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Enter your work email to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@applaud.test"
              autoComplete="email"
              required
            />
          </div>
          {state?.error ? (
            <p className="text-danger text-sm">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
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
                      className="border-border hover:bg-secondary flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
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
      </CardContent>
    </Card>
  );
}
