import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SitesManager, type SiteRow } from "@/components/admin/sites-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sites" };

export default async function AdminSitesPage() {
  await requireAdmin();
  const sites = await prisma.site.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });
  const rows: SiteRow[] = sites.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    timezone: s.timezone,
    active: s.active,
    userCount: s._count.users,
  }));

  return (
    <div>
      <PageHeader title="Sites" description="Locations across the organisation." />
      <SitesManager rows={rows} />
    </div>
  );
}
