import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ValuesManager, type ValueRow } from "@/components/admin/values-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Values" };

export default async function AdminValuesPage() {
  await requireAdmin();
  const values = await prisma.value.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  const rows: ValueRow[] = values.map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    icon: v.icon,
    color: v.color,
    order: v.order,
    active: v.active,
  }));

  return (
    <div>
      <PageHeader
        title="Values"
        description="The company values recognition is given against."
      />
      <ValuesManager rows={rows} />
    </div>
  );
}
