import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { KIND_LABELS, parseCosmeticPrices, pricedCosmetics, type CosmeticKind } from "@/lib/cosmetics";
import { getOrgSettings } from "@/lib/org-settings";
import { ownsItem, parseProfile } from "@/lib/profile-custom";
import { AppBar } from "@/components/app-shell/app-bar";
import { StoreTabs } from "@/components/shop/store-tabs";
import { ProfilePreview } from "@/components/shop/profile-preview";
import { ShopItem } from "@/components/shop/shop-item";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile shop" };

const KINDS: CosmeticKind[] = ["frame", "banner", "theme"];

/**
 * Profile shop (Steam Points Shop): spend points on avatar frames, banners
 * and accent themes. Your current look sits at the top; every item opens a
 * try-it-on sheet.
 */
export default async function ShopPage() {
  const viewer = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: viewer.id },
    select: { name: true, avatarUrl: true, walletBalance: true, profile: true },
  });
  const custom = parseProfile(me.profile);
  const catalogue = pricedCosmetics(parseCosmeticPrices((await getOrgSettings()).cosmeticPrices));
  const wearer = {
    name: me.name,
    avatarUrl: me.avatarUrl,
    frame: custom.frame,
    banner: custom.banner,
    theme: custom.theme,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <AppBar title="Store" tabs={<StoreTabs active="shop" />} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted text-sm">Your look</p>
        <p className="text-sm font-semibold" data-numeric>
          {formatNumber(me.walletBalance)} pts to spend
        </p>
      </div>
      <ProfilePreview {...wearer} className="mt-2" />

      <div className="mt-6 space-y-7">
        {KINDS.map((kind) => (
          <section key={kind}>
            <h2 className="mb-3 text-lg font-bold">{KIND_LABELS[kind].many}</h2>
            <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
              {catalogue.filter((c) => c.kind === kind).map((item) => (
                <ShopItem
                  key={item.id}
                  item={item}
                  me={wearer}
                  owned={ownsItem(custom, item.id)}
                  balance={me.walletBalance}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
