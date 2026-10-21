import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { COSMETIC_KINDS, KIND_LABELS, type Cosmetic } from "@/lib/cosmetics";
import { getCatalogue, getCategories } from "@/lib/catalogue";
import { bundleFor, ownsItem, parseProfile, resolveLook, wornItem } from "@/lib/profile-custom";
import { AppBar } from "@/components/app-shell/app-bar";
import { StoreTabs } from "@/components/shop/store-tabs";
import { ProfilePreview } from "@/components/shop/profile-preview";
import { ShopItem } from "@/components/shop/shop-item";
import { BundleCard } from "@/components/shop/bundle-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile shop" };

/**
 * Profile shop (Steam Points Shop): spend points on avatar frames, banners
 * and accent themes. Your current look sits at the top; every item opens a
 * try-it-on sheet. Items in a category (e.g. "Flags") are grouped under it with
 * a "Buy all" bundle; everything else is listed by kind.
 */
export default async function ShopPage() {
  const viewer = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: viewer.id },
    select: { name: true, avatarUrl: true, walletBalance: true, profile: true },
  });
  const custom = parseProfile(me.profile);
  const [catalogue, allCategories] = await Promise.all([getCatalogue(), getCategories()]);
  // Hidden items leave the shop, but anyone who owns one still sees it here.
  const shown = catalogue.filter((c) => c.active || ownsItem(custom, c));
  // Items in a hidden category are listed by kind like any other.
  const categories = allCategories.filter((cat) => cat.active && shown.some((c) => c.categoryId === cat.id));
  const grouped = new Set(categories.map((cat) => cat.id));
  const byKind = shown.filter((c) => !c.categoryId || !grouped.has(c.categoryId));
  const kindOrder = (c: Cosmetic) => COSMETIC_KINDS.indexOf(c.kind);
  const frame = wornItem(custom, "frame", catalogue);
  const wearer = {
    name: me.name,
    avatarUrl: me.avatarUrl,
    look: resolveLook(custom, catalogue),
    worn: {
      frame: frame?.id ?? null,
      banner: wornItem(custom, "banner", catalogue)?.id ?? null,
      theme: wornItem(custom, "theme", catalogue)?.id ?? null,
    },
    frameRarity: frame?.rarity ?? null,
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
      <ProfilePreview
        name={wearer.name}
        avatarUrl={wearer.avatarUrl}
        look={wearer.look}
        frameRarity={wearer.frameRarity}
        popKey={Object.values(wearer.worn).join("|")}
        className="mt-2"
      />

      <div className="mt-6 space-y-7">
        {categories.map((cat) => {
          // Frames first, then banners, then themes; admin order within each.
          const items = shown.filter((c) => c.categoryId === cat.id).sort((a, b) => kindOrder(a) - kindOrder(b));
          const bundle = bundleFor(custom, catalogue, cat.id);
          return (
            <section key={cat.id}>
              <h2 className="mb-3 text-lg font-bold">{cat.name}</h2>
              <div className="mb-4">
                <BundleCard
                  categoryId={cat.id}
                  categoryName={cat.name}
                  items={bundle.items}
                  price={bundle.price}
                  total={items.filter((c) => c.active).length}
                  balance={me.walletBalance}
                />
              </div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
                {items.map((item) => (
                  <ShopItem
                    key={item.id}
                    item={item}
                    me={wearer}
                    owned={ownsItem(custom, item)}
                    balance={me.walletBalance}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {COSMETIC_KINDS.filter((kind) => byKind.some((c) => c.kind === kind)).map((kind) => (
          <section key={kind}>
            <h2 className="mb-3 text-lg font-bold">{KIND_LABELS[kind].many}</h2>
            <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
              {byKind.filter((c) => c.kind === kind).map((item) => (
                <ShopItem
                  key={item.id}
                  item={item}
                  me={wearer}
                  owned={ownsItem(custom, item)}
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
