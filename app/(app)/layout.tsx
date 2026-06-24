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
      <TopNav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 sm:px-6 sm:pt-8 md:pb-10">
        {children}
      </main>
      <BottomNav user={user} />
    </div>
  );
}
