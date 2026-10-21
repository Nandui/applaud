import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AppBar } from "@/components/app-shell/app-bar";
import { BackButton } from "@/components/app-shell/back-button";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  // `data-admin` turns each admin page's PageHeader into an in-flow title on
  // phones, since this layout already owns the sticky app bar.
  return (
    <div data-admin className="flex flex-col md:flex-row md:gap-8">
      <AppBar title="Admin" leading={<BackButton fallback="/profile" />}>
        <AdminSidebar />
      </AppBar>
      <aside className="hidden md:block md:w-56 md:shrink-0">
        <div className="md:sticky md:top-20">
          <p className="text-muted mb-2 px-3 text-xs font-semibold tracking-wide uppercase">
            Admin
          </p>
          <AdminSidebar />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
