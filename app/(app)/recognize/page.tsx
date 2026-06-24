import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org-settings";
import { getAllowanceStatus } from "@/lib/points";
import { PageHeader } from "@/components/page-header";
import { RecognizeForm } from "./recognize-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Give recognition" };

export default async function RecognizePage() {
  const me = await requireUser();
  const settings = await getOrgSettings();

  const [values, users, allowance] = await Promise.all([
    prisma.value.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, icon: true, color: true },
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
        site: { select: { code: true } },
      },
    }),
    getAllowanceStatus(me, settings),
  ]);

  const recipients = users.map((u) => ({
    id: u.id,
    name: u.name,
    jobTitle: u.jobTitle,
    avatarUrl: u.avatarUrl,
    siteCode: u.site.code,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Give recognition"
        description="Recognise a colleague against a company value."
      />
      <RecognizeForm
        values={values}
        recipients={recipients}
        allowance={allowance}
      />
    </div>
  );
}
