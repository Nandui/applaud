import { prisma } from "@/lib/prisma";
import { Wordmark } from "@/components/app-shell/brand";
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

  // Phones: a splash with the wordmark up top and the form in a bottom sheet
  // (the Instagram / Snapchat welcome screen). Desktop: a centred card.
  return (
    <div className="flex w-full flex-1 flex-col md:max-w-md md:flex-none">
      <div className="pt-safe flex flex-1 flex-col items-center justify-center gap-4 px-6 pt-12 pb-10 text-center md:flex-none">
        <span className="shadow-float flex size-18 items-center justify-center rounded-[1.4rem] bg-[radial-gradient(circle_at_30%_25%,#7c5cff_0%,#2a1a6e_45%,#0b0b10_100%)]">
          <Sparkles className="size-9 text-[#c6f432]" fill="currentColor" strokeWidth={0} />
        </span>
        <Wordmark className="text-5xl" />
        <p className="text-muted max-w-xs text-base font-medium">
          Hype your team. Get hyped back. 👏
        </p>
      </div>
      <div className="bg-surface pb-safe shadow-float rounded-t-[2rem] md:rounded-3xl md:pb-0">
        <SignInForm samples={samples} />
      </div>
    </div>
  );
}
