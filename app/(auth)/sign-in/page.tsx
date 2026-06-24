import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/config";
import { Brand } from "@/components/app-shell/brand";
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

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Brand href="/sign-in" />
        <p className="text-muted text-sm">
          Sign in to {APP_NAME} to recognise great work.
        </p>
      </div>
      <SignInForm samples={samples} />
    </div>
  );
}
