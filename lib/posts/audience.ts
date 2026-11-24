import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { siteIdsOf, userSitesSelect } from "@/lib/sites";

/**
 * Polls and questions can be limited to certain sites
 * (Recognition.audienceSiteIds; empty = everyone). Someone sees a post when
 * it is for everyone, for one of their sites, or they wrote it. Admins see all of
 * them (moderation). Everything else in the feed is for everyone.
 */
export async function audienceWhere(viewerId: string): Promise<Prisma.RecognitionWhereInput> {
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { ...userSitesSelect, role: true },
  });
  if (viewer?.role === "admin") return {};
  const siteIds = viewer ? siteIdsOf(viewer) : [];
  return {
    OR: [
      { audienceSiteIds: { isEmpty: true } },
      { senderId: viewerId },
      ...(siteIds.length > 0 ? [{ audienceSiteIds: { hasSome: siteIds } }] : []),
    ],
  };
}

/** Whether this viewer may see (and so react to, vote on or answer) this post. */
export async function canViewerSee(recognitionId: string, viewerId: string): Promise<boolean> {
  const row = await prisma.recognition.findFirst({
    where: { AND: [{ id: recognitionId }, await audienceWhere(viewerId)] },
    select: { id: true },
  });
  return Boolean(row);
}

/** "Bishopstown & Mahon only", for the card header; null when it is for everyone. */
export async function audienceLabels(): Promise<Map<string, string>> {
  const sites = await prisma.site.findMany({ select: { id: true, name: true } });
  return new Map(sites.map((s) => [s.id, s.name]));
}

export function audienceLabel(siteIds: string[], names: Map<string, string>): string | null {
  if (siteIds.length === 0) return null;
  const list = siteIds.map((id) => names.get(id) ?? "a removed site");
  const joined = list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
  return `${joined} only`;
}
