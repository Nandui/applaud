import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getCoverAllowanceStatus } from "@/lib/points";
import { lookOf } from "@/lib/profile-custom";
import { getCatalogue } from "@/lib/catalogue";
import { canThankForCovers, coverPresets } from "@/lib/covers";
import { RecognizeForm } from "../recognize/recognize-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thank for covering" };

/**
 * Managers and above thank someone who covered a lesson, activity or shift
 * at short notice, with points from their separate cover allowance. The same
 * people picker and composer as Recognize, in cover mode.
 */
export default async function CoverPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const me = await requireUser();
  if (!canThankForCovers(me)) redirect("/recognize");
  const { to } = await searchParams;
  const settings = await getOrgSettings();

  const [users, allowance, recent, mine, catalogue] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, id: { not: me.id } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        avatarUrl: true,
        profile: true,
        site: { select: { code: true } },
        otherSites: { select: { site: { select: { code: true } } } },
      },
    }),
    getCoverAllowanceStatus(me, settings),
    // People I've thanked for covering lately, listed first.
    prisma.recognitionRecipient.findMany({
      where: { recognition: { senderId: me.id, kind: "cover" } },
      orderBy: { recognition: { createdAt: "desc" } },
      take: 30,
      select: { userId: true },
    }),
    prisma.site.findMany({
      where: { id: { in: me.siteIds } },
      select: { id: true, code: true },
    }),
    getCatalogue(),
  ]);

  const recipients = users.map((u) => ({
    id: u.id,
    name: u.name,
    jobTitle: u.jobTitle,
    avatarUrl: u.avatarUrl,
    frame: lookOf(u.profile, catalogue).frame,
    siteCode: u.site?.code ?? "",
    siteCodes: [u.site?.code, ...u.otherSites.map((s) => s.site.code)].filter((c): c is string => Boolean(c)),
  }));
  const pickable = new Set(recipients.map((r) => r.id));
  const recentIds = [...new Set(recent.map((r) => r.userId))].filter((id) => pickable.has(id)).slice(0, 6);
  const initialSelected = to && pickable.has(to) ? [to] : [];

  const max = settings.maxPointsPerCover;
  const suggested = Math.min(
    settings.coverPointsSuggested,
    max > 0 ? max : settings.coverPointsSuggested,
    allowance.remaining,
  );

  return (
    <RecognizeForm
      values={[]}
      recipients={recipients}
      allowance={allowance}
      initialSelected={initialSelected}
      recentIds={recentIds}
      mySiteCodes={me.siteIds
        .map((id) => mine.find((s) => s.id === id)?.code)
        .filter((c): c is string => Boolean(c))}
      me={{ name: me.name, avatarUrl: me.avatarUrl ?? null }}
      cover={{ suggested, presets: coverPresets(settings.coverPointsSuggested, max) }}
    />
  );
}
