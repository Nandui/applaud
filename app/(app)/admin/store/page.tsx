import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getCatalogue, getCategories } from "@/lib/catalogue";
import { POINT_PRESETS } from "@/lib/economy";
import { PageHeader } from "@/components/page-header";
import { StoreManager, type StoreRow } from "@/components/admin/store-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Store" };

export default async function AdminStorePage() {
  const admin = await requireAdmin();
  const [settings, catalogue, categories, purchases, me] = await Promise.all([
    getOrgSettings(),
    getCatalogue(),
    getCategories(),
    prisma.rewardLedger.groupBy({
      by: ["sourceId"],
      where: { type: "SHOP", sourceType: "cosmetic" },
      _count: { _all: true },
    }),
    prisma.user.findUnique({ where: { id: admin.id }, select: { name: true, avatarUrl: true } }),
  ]);
  const buyers = new Map(purchases.map((p) => [p.sourceId, p._count._all]));
  const rows: StoreRow[] = catalogue.map((c) => ({ ...c, buyers: buyers.get(c.id) ?? 0 }));

  return (
    <div>
      <PageHeader
        title="Store"
        description="The avatar frames, banners and themes staff buy with points in the profile shop. Upload your own pictures, set prices and rarity, group items into categories that sell as bundles, and hide anything you no longer want to sell."
      />
      <StoreManager
        rows={rows}
        categories={categories}
        sample={{ name: me?.name ?? "Your name", avatarUrl: me?.avatarUrl ?? null }}
        pointsPerEuro={settings.pointsPerEuro}
        typicalShoutout={POINT_PRESETS[0]}
      />
    </div>
  );
}
