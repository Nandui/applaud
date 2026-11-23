import { requireAdmin } from "@/lib/auth/guards";
import { NewItemsProvider } from "@/components/app-shell/new-items";
import { NO_NEW } from "@/lib/seen";

/**
 * Bare pages that Admin > Rewards shows inside its phone-size preview frame:
 * no side nav or tab bar, nothing that stamps the admin's own "seen" times.
 */
export default async function AdminPreviewLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <NewItemsProvider counts={NO_NEW}>
      <main className="px-4 pb-10">{children}</main>
    </NewItemsProvider>
  );
}
