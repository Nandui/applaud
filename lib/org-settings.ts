import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const ORG_SETTINGS_TAG = "org-settings";

/**
 * The OrgSettings singleton. Created with defaults on first read if missing.
 * Read on most screens but only changed in Admin > Settings and Admin >
 * Economy, so it is kept in the Next data cache across requests (cleared by
 * those actions via ORG_SETTINGS_TAG, and refreshed every 5 minutes as a
 * safety net) and memoised per request via React cache().
 */
const loadOrgSettings = unstable_cache(
  async () => {
    const existing = await prisma.orgSettings.findUnique({
      where: { id: "singleton" },
    });
    if (existing) return existing;
    return prisma.orgSettings.create({ data: { id: "singleton" } });
  },
  ["org-settings"],
  { tags: [ORG_SETTINGS_TAG], revalidate: 300 },
);

export const getOrgSettings = cache(() => loadOrgSettings());

export type OrgSettings = Awaited<ReturnType<typeof getOrgSettings>>;
