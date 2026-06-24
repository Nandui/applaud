import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      <aside className="md:w-56 md:shrink-0">
        <div className="md:sticky md:top-20">
          <p className="text-muted mb-2 hidden px-3 text-xs font-semibold tracking-wide uppercase md:block">
            Admin
          </p>
          <AdminSidebar />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
