import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/config";
import { Sparkles } from "lucide-react";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  // Sample one user per role so the dev quick-switch can demo gated nav.
  const [admin, manager, staff] = await Promise.all([
    prisma.user.findFirst({
      where: { role: "admin", active: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findFirst({
      where: { role: "manager", active: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "staff", active: true },
      orderBy: { name: "asc" },
      take: 2,
    }),
  ]);

  const samples = [admin, manager, ...staff]
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      jobTitle: u.jobTitle,
    }));

  // Phones: a full-bleed brand splash with the form in a bottom sheet (the
  // Instagram / Snapchat welcome screen). Desktop: a centred card.
  return (
    <div className="flex w-full flex-1 flex-col md:max-w-md md:flex-none">
      <div className="pt-safe flex flex-1 flex-col items-center justify-center gap-3 px-6 pt-10 pb-8 text-center text-white md:flex-none md:pb-8">
        <span className="flex size-16 items-center justify-center rounded-[1.3rem] bg-white/20 shadow-xl ring-1 ring-white/30 backdrop-blur">
          <Sparkles className="size-8" strokeWidth={2} />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-4xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="text-base text-white/85">
            Celebrate great work, together. 👏
          </p>
        </div>
      </div>
      <div className="bg-surface pb-safe rounded-t-[2rem] shadow-[0_-12px_40px_rgb(0_0_0/0.15)] md:rounded-3xl md:pb-0">
        <SignInForm samples={samples} />
      </div>
    </div>
  );
}
