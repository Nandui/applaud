import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { UsersManager, type UserRow } from "@/components/admin/users-manager";
import { GooglePhotosButton } from "@/components/admin/google-photos-button";
import { googleSignInEnabled } from "@/lib/auth/mode";
import { isTestEmail } from "@/lib/test-accounts";
import { JoinNudge } from "@/components/admin/join-nudge";
import { canEmail, EMAIL_GAP_DAYS, irishTime, lastNudge, nextNudgeAt, notJoinedPeople } from "@/lib/invite/nudge";
import { chatConfigured } from "@/lib/chat/google-chat";
import { getOrgSettings } from "@/lib/org-settings";
import { WELCOME_POINTS } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };
// "Nudge people to join" emails everyone waiting, a few at a time.
export const maxDuration = 60;

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const [users, sites, waiting, last, settings, mailbox] = await Promise.all([
    prisma.user.findMany({
      // Removed people are detached from their site; they stay out of the list.
      where: { siteId: { not: null } },
      // People created on their first Google sign-in come first until checked.
      orderBy: [{ needsReview: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        jobTitle: true,
        role: true,
        pointsRank: true,
        siteId: true,
        hireDate: true,
        birthday: true,
        active: true,
        needsReview: true,
        onboardedAt: true,
        accounts: { select: { id: true }, take: 1 },
        site: { select: { name: true } },
        otherSites: {
          orderBy: { site: { name: "asc" } },
          select: { site: { select: { id: true, name: true } } },
        },
        managers: {
          orderBy: { manager: { name: "asc" } },
          select: { manager: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.site.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    notJoinedPeople(),
    lastNudge(),
    getOrgSettings(),
    prisma.gmailConnection.findUnique({ where: { id: "singleton" }, select: { id: true } }),
  ]);
  const now = new Date();
  const live = process.env.VERCEL_ENV === "production";

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    jobTitle: u.jobTitle,
    role: u.role,
    pointsRank: u.pointsRank,
    siteId: u.siteId ?? "",
    siteName: u.site?.name ?? "—",
    otherSiteIds: u.otherSites.map((s) => s.site.id),
    otherSiteNames: u.otherSites.map((s) => s.site.name),
    managerIds: u.managers.map((m) => m.manager.id),
    managerNames: u.managers.map((m) => m.manager.name),
    hireDate: isoDate(u.hireDate),
    birthday: isoDate(u.birthday),
    active: u.active,
    needsReview: u.needsReview,
    onboarded: u.onboardedAt !== null,
    joined: u.accounts.length > 0,
    isTest: isTestEmail(u.email),
  }));

  const managers = users.map((u) => ({ id: u.id, name: u.name }));

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage people, their sites, managers, company roles, app roles and points ranks."
        action={googleSignInEnabled ? <GooglePhotosButton /> : undefined}
      />
      <JoinNudge
        appName={settings.appName}
        waiting={waiting.map((p) => ({ name: p.name, due: canEmail(p, now) }))}
        emailGapDays={EMAIL_GAP_DAYS}
        welcomePoints={WELCOME_POINTS}
        last={last && { at: irishTime(last.at), by: last.by, emails: last.emails, chat: last.chat }}
        nextAt={(() => {
          const next = nextNudgeAt(last, now);
          return next ? irishTime(next) : null;
        })()}
        chatReady={chatConfigured()}
        mailReady={live && googleSignInEnabled && mailbox !== null}
        live={live}
      />
      <UsersManager
        rows={rows}
        sites={sites}
        managers={managers}
        currentUserId={admin.id}
      />
    </div>
  );
}
