import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * The OrgSettings singleton. Created with defaults on first read if missing.
 * Memoised per-request via React cache().
 */
export const getOrgSettings = cache(async () => {
  const existing = await prisma.orgSettings.findUnique({
    where: { id: "singleton" },
  });
  if (existing) return existing;
  return prisma.orgSettings.create({ data: { id: "singleton" } });
});

export type OrgSettings = Awaited<ReturnType<typeof getOrgSettings>>;
