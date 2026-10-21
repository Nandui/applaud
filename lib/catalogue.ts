import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { builtinCatalogue, isKind, isRarity, type Cosmetic, type StoreCategory } from "@/lib/cosmetics";

/**
 * The profile Store catalogue from the `Cosmetic` table, in display order,
 * hidden items included (people who own one keep wearing it). Memoised
 * per request via React cache(). Falls back to the built-in items if the table
 * is empty, so a fresh database still has a working Store.
 */
export const getCatalogue = cache(async (): Promise<Cosmetic[]> => {
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
      active: r.active,
      categoryId: r.categoryId,
    }));
});

/** Store categories in display order, hidden ones included. Memoised per request. */
export const getCategories = cache(async (): Promise<StoreCategory[]> => {
  return prisma.cosmeticCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, active: true },
  });
});
