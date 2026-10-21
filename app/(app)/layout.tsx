import { requireUser } from "@/lib/auth/guards";
import { SideNav } from "@/components/app-shell/side-nav";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl">
      {/* Desktop rail. Phones get a per-screen AppBar + the floating tab bar. */}
      <SideNav user={user} />
      <main className="pb-tabbar min-w-0 flex-1 px-4 md:px-8 md:pb-12">{children}</main>
      <BottomNav user={user} />
    </div>
  );
}
