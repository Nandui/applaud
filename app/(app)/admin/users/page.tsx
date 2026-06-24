import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { UsersManager, type UserRow } from "@/components/admin/users-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function AdminUsersPage() {
  await requireAdmin();

  const [users, sites] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        role: true,
        siteId: true,
        hireDate: true,
        birthday: true,
        active: true,
        site: { select: { name: true } },
        manager: { select: { id: true, name: true } },
      },
    }),
    prisma.site.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    jobTitle: u.jobTitle,
    role: u.role,
    siteId: u.siteId,
    siteName: u.site.name,
    managerId: u.manager?.id ?? null,
    managerName: u.manager?.name ?? null,
    hireDate: isoDate(u.hireDate),
    birthday: isoDate(u.birthday),
    active: u.active,
  }));

  const managers = users.map((u) => ({ id: u.id, name: u.name }));

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage people, sites, managers, and roles."
      />
      <UsersManager rows={rows} sites={sites} managers={managers} />
    </div>
  );
}
