import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

/**
 * Who a Google sign-in belongs to.
 *
 * The person is matched to their Yayup user by email, ignoring case (rows
 * added by hand or by the roster import may say "John.Smith@…"); a match in
 * another case is rewritten to lower case so Auth.js, which looks users up by
 * exact email, finds the same row.
 *
 * Nobody matched: if Admin > Settings allows it (on by default), a staff
 * account is created on the spot at the site most people work at, flagged
 * `needsReview` so it stands out in Admin > Users until an admin has checked
 * its role and site. The giving allowance follows from the role, so there is
 * nothing to set up for points.
 *
 * Callers must already have checked the email is verified, and pass
 * `mayCreate` only for emails from the company workspace (see auth.ts).
 */

export type GoogleAccountResult =
  | { ok: true; user: { id: string; avatarUrl: string | null } }
  | { ok: false; error: "NotInvited" | "AccountDisabled" };

function isUniqueError(e: unknown): boolean {
  return !!e && typeof e === "object" && (e as { code?: string }).code === "P2002";
}

export function normaliseEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

/** A display name from the Google profile, falling back to the email. */
export function nameFromGoogle(
  profile: { name?: unknown; given_name?: unknown; family_name?: unknown },
  email: string,
): string {
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
  const full =
    clean(profile.name) ||
    [clean(profile.given_name), clean(profile.family_name)].filter(Boolean).join(" ");
  if (full) return full.slice(0, 80);
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._-]+/).filter(Boolean);
  const guess = words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return guess || email;
}

/** The site with the most active people (ties by name), or null if there are no sites. */
async function defaultSiteId(): Promise<string | null> {
  const sites = await prisma.site.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, _count: { select: { users: { where: { active: true } } } } },
  });
  let best: (typeof sites)[number] | null = null;
  for (const site of sites) {
    if (!best || site._count.users > best._count.users) best = site;
  }
  return best?.id ?? null;
}

async function findByEmail(email: string) {
  const select = { id: true, email: true, active: true, avatarUrl: true } as const;
  return (
    (await prisma.user.findUnique({ where: { email }, select })) ??
    (await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
      select,
    }))
  );
}

export async function resolveGoogleUser(
  email: string,
  profile: { name?: unknown; given_name?: unknown; family_name?: unknown },
  { mayCreate }: { mayCreate: boolean },
): Promise<GoogleAccountResult> {
  const existing = await findByEmail(email);
  if (existing) {
    if (!existing.active) return { ok: false, error: "AccountDisabled" };
    if (existing.email !== email) {
      await prisma.user.update({ where: { id: existing.id }, data: { email } });
    }
    return { ok: true, user: existing };
  }

  if (!mayCreate) return { ok: false, error: "NotInvited" };
  // Read fresh (not the cached settings): it only runs on a first sign-in.
  const settings = await prisma.orgSettings.findUnique({
    where: { id: "singleton" },
    select: { autoCreateGoogleUsers: true },
  });
  if (settings && !settings.autoCreateGoogleUsers) return { ok: false, error: "NotInvited" };
  const siteId = await defaultSiteId();
  if (!siteId) return { ok: false, error: "NotInvited" };

  const name = nameFromGoogle(profile, email);
  try {
    const user = await prisma.user.create({
      data: { email, name, role: "staff", siteId, needsReview: true },
      select: { id: true, avatarUrl: true },
    });
    await writeAudit({
      action: "user.auto_created",
      entityType: "user",
      entityId: user.id,
      summary: `Created ${name} on their first Google sign-in`,
      metadata: { email, role: "staff", siteId },
      siteId,
    });
    return { ok: true, user };
  } catch (e) {
    // Two first sign-ins at once: the other one created the row.
    if (!isUniqueError(e)) throw e;
    const again = await findByEmail(email);
    if (!again) throw e;
    return again.active ? { ok: true, user: again } : { ok: false, error: "AccountDisabled" };
  }
}
