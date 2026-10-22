import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { builtinCatalogue, isKind, isRarity, type Cosmetic, type StoreCategory } from "@/lib/cosmetics";

/**
 * The profile Store catalogue from the `Cosmetic` table, in display order,
 * hidden items included (people who own one keep wearing it). Almost every
 * screen needs it and it only changes in Admin > Store, so it is kept in the
 * Next data cache across requests (tag CATALOGUE_TAG, cleared by the Store
 * actions) as well as memoised per request via React cache(). Falls back to the built-in items if the table
 * is empty, so a fresh database still has a working Store.
 */
export const CATALOGUE_TAG = "store-catalogue";

/** Safety net for edits made outside the app (scripts, SQL): refresh every 5 minutes. */
const REVALIDATE_SECONDS = 300;

const loadCatalogue = unstable_cache(
  async (): Promise<Cosmetic[]> => {
  const rows = await prisma.cosmetic.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (rows.length === 0) return builtinCatalogue();
  return rows
    .filter((r) => isKind(r.kind))
    .map((r) => ({
      id: r.id,
      kind: r.kind as Cosmetic["kind"],
      name: r.name,
      price: r.price,
      rarity: isRarity(r.rarity) ? r.rarity : "common",
      style: r.style,
      imageUrl: r.imageUrl,
      frameFit: r.frameFit,
      active: r.active,
      categoryId: r.categoryId,
    }));
  },
  ["store-catalogue"],
  { tags: [CATALOGUE_TAG], revalidate: REVALIDATE_SECONDS },
);

export const getCatalogue = cache(() => loadCatalogue());

/** Store categories in display order, hidden ones included. Cached like the catalogue. */
const loadCategories = unstable_cache(
  async (): Promise<StoreCategory[]> =>
    prisma.cosmeticCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, active: true },
    }),
  ["store-categories"],
  { tags: [CATALOGUE_TAG], revalidate: REVALIDATE_SECONDS },
);

export const getCategories = cache(() => loadCategories());
