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
import { MarkSeen } from "@/components/app-shell/new-items";
import { isNewSince, visitStamp } from "@/lib/seen";
import { RANK_LABELS, isPointsRank, shopIsFreeFor } from "@/lib/ranks";
import { Crown } from "lucide-react";

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
  const renderedAt = visitStamp();
  const [me, catalogue, allCategories] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: viewer.id },
      select: { name: true, avatarUrl: true, walletBalance: true, profile: true, shopSeenAt: true },
    }),
    getCatalogue(),
    getCategories(),
  ]);
  const custom = parseProfile(me.profile);
  // Every rank above Staff gets the shop free; the server checks this again on purchase.
  const perk =
    shopIsFreeFor(viewer.pointsRank) && isPointsRank(viewer.pointsRank) ? RANK_LABELS[viewer.pointsRank] : null;
  // Listed since your last visit and not yours yet: tagged "New" this time round.
  const isNew = (c: Cosmetic) => c.active && !ownsItem(custom, c) && isNewSince(c.listedAt, me.shopSeenAt);
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
      <MarkSeen area="shop" renderedAt={renderedAt} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted text-sm">Your look</p>
        <p className="text-sm font-semibold" data-numeric>
          {formatNumber(me.walletBalance)} pts to spend
        </p>
      </div>
      {/* The app tour points at this card. */}
      <div data-tour="shop-look" className="mt-2">
        <ProfilePreview
          name={wearer.name}
          avatarUrl={wearer.avatarUrl}
          look={wearer.look}
          frameRarity={wearer.frameRarity}
          popKey={Object.values(wearer.worn).join("|")}
        />
      </div>

      {perk ? (
        <div className="border-primary/30 bg-primary/10 mt-4 flex items-start gap-3 rounded-xl border px-4 py-3">
          <span className="bg-primary text-primary-fg flex size-9 shrink-0 items-center justify-center rounded-full">
            <Crown className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Everything here is free for you</p>
            <p className="text-muted text-sm">
              A {perk} perk: take any frame, banner or theme without spending points. Staff see the normal prices.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 space-y-7">
        {categories.map((cat) => {
          // Frames first, then banners, then themes; admin order within each.
          const items = shown.filter((c) => c.categoryId === cat.id).sort((a, b) => kindOrder(a) - kindOrder(b));
          const bundle = bundleFor(custom, catalogue, cat.id);
          return (
            <section key={cat.id}>
              <SectionTitle title={cat.name} fresh={items.filter(isNew).length} />
              <div className="mb-4">
                <BundleCard
                  categoryId={cat.id}
                  categoryName={cat.name}
                  items={bundle.items}
                  price={perk ? 0 : bundle.price}
                  listPrice={bundle.price}
                  perk={perk}
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
                    isNew={isNew(item)}
                    perk={perk}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {COSMETIC_KINDS.filter((kind) => byKind.some((c) => c.kind === kind)).map((kind) => (
          <section key={kind}>
            <SectionTitle title={KIND_LABELS[kind].many} fresh={byKind.filter((c) => c.kind === kind && isNew(c)).length} />
            <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
              {byKind.filter((c) => c.kind === kind).map((item) => (
                <ShopItem
                  key={item.id}
                  item={item}
                  me={wearer}
                  owned={ownsItem(custom, item)}
                  balance={me.walletBalance}
                  isNew={isNew(item)}
                  perk={perk}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** A section heading, with how many of its items are new to you. */
function SectionTitle({ title, fresh }: { title: string; fresh: number }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 text-lg font-bold">
      {title}
      {fresh > 0 ? (
        <span className="text-primary text-sm font-semibold" data-numeric>
          {fresh} new
        </span>
      ) : null}
    </h2>
  );
}
