import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getAllowanceStatus } from "@/lib/points";
import { parseProfile } from "@/lib/profile-custom";
import { RecognizeForm } from "./recognize-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Send a shout-out" };

export default async function RecognizePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const me = await requireUser();
  const { to } = await searchParams;
  const settings = await getOrgSettings();

  const [values, users, allowance, recent, mine] = await Promise.all([
    prisma.value.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, icon: true, color: true, imageUrl: true },
    }),
    prisma.user.findMany({
      where: {
        active: true,
        ...(settings.allowSelfRecognition ? {} : { id: { not: me.id } }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        avatarUrl: true,
        profile: true,
        site: { select: { code: true } },
      },
    }),
    getAllowanceStatus(me, settings),
    // People I've recognised lately, listed first.
    prisma.recognitionRecipient.findMany({
      where: { recognition: { senderId: me.id, system: false } },
      orderBy: { recognition: { createdAt: "desc" } },
      take: 30,
      select: { userId: true },
    }),
    prisma.site.findFirst({
      where: { id: me.siteId ?? "" },
      select: { code: true },
    }),
  ]);

  const recipients = users.map((u) => ({
    id: u.id,
    name: u.name,
    jobTitle: u.jobTitle,
    avatarUrl: u.avatarUrl,
    frame: parseProfile(u.profile).frame,
    siteCode: u.site?.code ?? "",
  }));

  const pickable = new Set(recipients.map((r) => r.id));
  const recentIds = [...new Set(recent.map((r) => r.userId))]
    .filter((id) => pickable.has(id))
    .slice(0, 6);

  // "Recognise Aoife" from a profile preselects her (if she's pickable).
  const initialSelected = to && recipients.some((r) => r.id === to) ? [to] : [];

  return (
    <RecognizeForm
      values={values}
      recipients={recipients}
      allowance={allowance}
      initialSelected={initialSelected}
      recentIds={recentIds}
      mySiteCode={mine?.code ?? ""}
      me={{ name: me.name, avatarUrl: me.avatarUrl ?? null }}
    />
  );
}
