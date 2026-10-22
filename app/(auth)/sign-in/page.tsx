import { prisma } from "@/lib/prisma";
import { Wordmark } from "@/components/app-shell/brand";
import { devSignInEnabled, googleSignInEnabled } from "@/lib/auth/mode";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  NotInvited:
    "That Google account isn't on Yayup yet. Ask an admin to add you with this email.",
  WrongDomain: "Use your work Google account to sign in.",
  GoogleUnverified: "Google couldn't confirm that email address. Try another account.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const errorMessage = error
    ? (ERRORS[error] ?? "Sign-in didn't work. Please try again.")
    : undefined;

  // Sample one user per role so the dev quick-switch can demo gated nav.
  const samples = devSignInEnabled ? await sampleUsers() : [];

  // Phones: a splash with the wordmark up top and the form in a bottom sheet
  // (the Instagram / Snapchat welcome screen). Desktop: a centred card.
  return (
    <div className="flex w-full flex-1 flex-col md:max-w-md md:flex-none">
      <div className="pt-safe flex flex-1 flex-col items-center justify-center gap-4 px-6 pt-12 pb-10 text-center md:flex-none">
        <Wordmark className="text-5xl" />
        <p className="text-muted max-w-xs text-base font-medium">
          Hype your team. Get hyped back. 👏
        </p>
      </div>
      <div className="bg-surface pb-safe shadow-float rounded-t-[2rem] md:rounded-3xl md:pb-0">
        <SignInForm
          samples={samples}
          google={googleSignInEnabled}
          dev={devSignInEnabled}
          callbackUrl={callbackUrl}
          error={errorMessage}
        />
      </div>
    </div>
  );
}

async function sampleUsers() {
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

  return [admin, manager, ...staff]
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      jobTitle: u.jobTitle,
    }));
}
