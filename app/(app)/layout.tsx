import { requireUser } from "@/lib/auth/guards";
import { TopNav } from "@/components/app-shell/top-nav";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      {/* Desktop chrome. Phones get a per-screen AppBar + the tab bar. */}
      <TopNav user={user} />
      <main className="pb-tabbar mx-auto w-full max-w-6xl flex-1 px-4 md:px-6 md:pt-8 md:pb-10">
        {children}
      </main>
      <BottomNav user={user} />
    </div>
  );
}
