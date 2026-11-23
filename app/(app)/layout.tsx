import { requireUser } from "@/lib/auth/guards";
import { SideNav } from "@/components/app-shell/side-nav";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { NewItemsProvider } from "@/components/app-shell/new-items";
import { IdleSignOut } from "@/components/app-shell/idle-sign-out";
import { getNewCounts } from "@/lib/new-items";
import { getOrgSettings } from "@/lib/org-settings";
import { allowanceForRank } from "@/lib/ranks";
import { TourProvider } from "@/components/onboarding/tour";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [newCounts, settings] = await Promise.all([
    getNewCounts(user),
    getOrgSettings(),
  ]);
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  return (
    <NewItemsProvider counts={newCounts}>
      <TourProvider
        onboarded={user.onboarded ?? true}
        firstName={firstName}
        allowance={allowanceForRank(user.pointsRank, settings)}
      >
        <div className="mx-auto flex min-h-full w-full max-w-6xl">
          {/* Desktop rail. Phones get a per-screen AppBar + the floating tab bar. */}
          <SideNav user={user} />
          <main className="pb-tabbar min-w-0 flex-1 px-4 md:px-8 md:pb-12">
            {children}
          </main>
          <BottomNav user={user} />
        </div>
      </TourProvider>
      <IdleSignOut />
    </NewItemsProvider>
  );
}
