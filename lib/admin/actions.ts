"use server";

import { isPointsRank, rankForRole } from "@/lib/ranks";
import { backfillGoogleAvatars, isGooglePictureUrl } from "@/lib/google-avatar";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { isProjectBlobUrl } from "@/lib/blob";
import { badgeLookError } from "@/lib/value-icons";
import { writeAudit } from "@/lib/audit";
import { isTestEmail, TEST_EMAIL_DOMAIN } from "@/lib/test-accounts";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function isUniqueError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

function isForeignKeyError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "code" in e &&
    (e as { code?: string }).code === "P2003"
  );
}

function stillHasPeople(name: string, count: number): string {
  return `${name} still has ${count} ${count === 1 ? "person" : "people"} assigned. Move them to another site first — removing a site never deletes its people.`;
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s + "T00:00:00.000Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------- Values ----------

export async function saveValue(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const order = Math.floor(Number(formData.get("order") ?? 0));
  const active = String(formData.get("active") ?? "true") === "true";
  if (name.length < 2) return { ok: false, error: "Name is too short." };
  if (imageUrl && !isProjectBlobUrl(imageUrl)) return { ok: false, error: "Unrecognised picture URL." };
  const lookError = badgeLookError(icon, color);
  if (lookError) return { ok: false, error: lookError };

  const data = {
    name,
    description: description || null,
    // The holo badge is drawn from icon + colour; an uploaded picture fills
    // the hexagon instead of the icon (the colour still tints the glow).
    ...(icon ? { icon } : {}),
    ...(color ? { color: color.toLowerCase() } : {}),
    imageUrl: imageUrl || null,
    order: Number.isFinite(order) ? order : 0,
    active,
  };
  let entityId = id;
  if (id) await prisma.value.update({ where: { id }, data });
  else {
    const created = await prisma.value.create({ data });
    entityId = created.id;
  }
  await writeAudit({
    actor: admin,
    action: id ? "value.updated" : "value.created",
    entityType: "value",
    entityId,
    summary: id ? `Updated value ${name}` : `Created value ${name}`,
    metadata: { active, order: data.order },
  });
  revalidatePath("/admin/values");
  revalidatePath("/recognize");
  return { ok: true, message: id ? "Value updated." : "Value created." };
}

export async function setValueActive(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing value." };
  await prisma.value.update({ where: { id }, data: { active } });
  await writeAudit({
    actor: admin,
    action: "value.updated",
    entityType: "value",
    entityId: id,
    summary: active ? "Reactivated a value" : "Deactivated a value",
    metadata: { active },
  });
  revalidatePath("/admin/values");
  return { ok: true };
}

// ---------- Sites ----------

export async function saveSite(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const timezone = String(formData.get("timezone") ?? "").trim() || "Europe/Dublin";
  const active = String(formData.get("active") ?? "true") === "true";
  if (name.length < 2) return { ok: false, error: "Name is too short." };
  if (!/^[A-Z0-9]{2,8}$/.test(code)) {
    return { ok: false, error: "Code must be 2–8 letters/numbers." };
  }

  const data = { name, code, timezone, active };
  let entityId = id;
  try {
    if (id) await prisma.site.update({ where: { id }, data });
    else {
      const created = await prisma.site.create({ data });
      entityId = created.id;
    }
  } catch (e) {
    if (isUniqueError(e)) return { ok: false, error: "That site code is taken." };
    throw e;
  }
  await writeAudit({
    actor: admin,
    action: id ? "site.updated" : "site.created",
    entityType: "site",
    entityId,
    summary: id ? `Updated site ${name} (${code})` : `Created site ${name} (${code})`,
    metadata: { code, active, timezone },
    siteId: entityId || null,
  });
  revalidatePath("/admin/sites");
  return { ok: true, message: id ? "Site updated." : "Site created." };
}

export async function setSiteActive(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing site." };
  await prisma.site.update({ where: { id }, data: { active } });
  await writeAudit({
    actor: admin,
    action: "site.updated",
    entityType: "site",
    entityId: id,
    summary: active ? "Reactivated a site" : "Deactivated a site",
    metadata: { active },
    siteId: id,
  });
  revalidatePath("/admin/sites");
  return { ok: true };
}

/**
 * Hard-deletes a site. People are never cascaded: a site with users assigned is
 * refused, so the only way to remove one is to move its people off it first.
 */
export async function deleteSite(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing site." };

  const site = await prisma.site.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!site) return { ok: false, error: "That site no longer exists." };
  if (site._count.users > 0) return { ok: false, error: stillHasPeople(site.name, site._count.users) };

  // Rewards carry a plain siteId (no FK), so they survive the delete but stop
  // matching anyone. Record the count so the audit trail explains the gap.
  const scopedRewards = await prisma.reward.count({ where: { siteId: id } });

  try {
    await prisma.site.delete({ where: { id } });
  } catch (e) {
    // Someone assigned a user between the count and the delete.
    if (isForeignKeyError(e)) {
      const users = await prisma.user.count({ where: { siteId: id } });
      return { ok: false, error: stillHasPeople(site.name, users) };
    }
    throw e;
  }

  await writeAudit({
    actor: admin,
    action: "site.deleted",
    entityType: "site",
    entityId: id,
    summary: `Deleted site ${site.name} (${site.code})`,
    metadata: {
      code: site.code,
      timezone: site.timezone,
      active: site.active,
      scopedRewards,
    },
    siteId: id,
  });
  revalidatePath("/admin/sites");
  revalidatePath("/admin/users");
  return { ok: true, message: `${site.name} removed.` };
}

// ---------- Users ----------

const ROLES = ["staff", "manager", "admin", "operations", "ceo"];

export async function saveUser(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const role = String(formData.get("role") ?? "staff");
  // Older forms don't post a rank: fall back to the one that matches the role.
  const pointsRank = String(formData.get("pointsRank") ?? "") || rankForRole(role);
  const siteId = String(formData.get("siteId") ?? "").trim();
  // Zero or more managers, each a real user; the select posts one entry per pick.
  const managerIds = [
    ...new Set(
      formData
        .getAll("managerIds")
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  ];
  const active = String(formData.get("active") ?? "true") === "true";
  const hireDate = parseDate(formData.get("hireDate"));
  const birthday = parseDate(formData.get("birthday"));
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();

  if (name.length < 2) return { ok: false, error: "Name is too short." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (!ROLES.includes(role)) return { ok: false, error: "Invalid role." };
  if (!isPointsRank(pointsRank)) return { ok: false, error: "Invalid points rank." };
  if (!siteId) return { ok: false, error: "Pick a site." };
  if (id && managerIds.includes(id)) {
    return { ok: false, error: "A user can't be their own manager." };
  }
  if (managerIds.length > 0) {
    const found = await prisma.user.count({ where: { id: { in: managerIds } } });
    if (found !== managerIds.length) {
      return { ok: false, error: "One of those managers no longer exists." };
    }
  }
  // Their Google picture may be linked straight from Google (lib/google-avatar.ts).
  if (avatarUrl && !isProjectBlobUrl(avatarUrl) && !isGooglePictureUrl(avatarUrl)) {
    return { ok: false, error: "Unrecognised picture URL." };
  }

  const data = {
    name,
    email,
    jobTitle: jobTitle || null,
    role,
    pointsRank,
    siteId,
    active,
    hireDate,
    birthday,
    avatarUrl: avatarUrl || null,
  };
  // The picked set replaces whatever was there — no partial merge.
  const managers = managerIds.map((managerId) => ({ managerId }));
  let entityId = id;
  try {
    if (id) {
      await prisma.user.update({
        where: { id },
        // Saving someone counts as having checked an auto-created account.
        data: {
          ...data,
          needsReview: false,
          managers: { deleteMany: {}, create: managers },
        },
      });
    } else {
      const created = await prisma.user.create({
        data: { ...data, managers: { create: managers } },
      });
      entityId = created.id;
    }
  } catch (e) {
    if (isUniqueError(e)) {
      // A removed person keeps their row (and email) when history blocked the
      // delete, so say which kind of clash this is.
      const clash = await prisma.user.findUnique({
        where: { email },
        select: { siteId: true },
      });
      return {
        ok: false,
        error: clash && clash.siteId === null
          ? "That email belongs to a removed user."
          : "That email is already in use.",
      };
    }
    throw e;
  }
  await writeAudit({
    actor: admin,
    action: id ? "user.updated" : "user.created",
    entityType: "user",
    entityId,
    summary: id ? `Updated user ${name} (${role})` : `Created user ${name} (${role})`,
    metadata: {
      email,
      role,
      pointsRank,
      siteId,
      active,
      jobTitle: jobTitle || null,
      managerIds,
    },
    siteId,
  });
  revalidatePath("/admin/users");
  return { ok: true, message: id ? "User updated." : "User created." };
}

export async function setUserActive(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing user." };
  await prisma.user.update({ where: { id }, data: { active } });
  await writeAudit({
    actor: admin,
    action: "user.updated",
    entityType: "user",
    entityId: id,
    summary: active ? "Reactivated a user" : "Deactivated a user",
    metadata: { active },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Admin > Users: give everyone whose picture is missing, or no longer loads,
 * their Google picture now.
 */
export async function applyGooglePhotos(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { checked, updated, stale, noPicture } = await backfillGoogleAvatars();
  if (updated > 0) {
    await writeAudit({
      actor: admin,
      action: "user.updated",
      entityType: "user",
      entityId: admin.id,
      summary: `Set the Google picture as the avatar of ${updated} ${updated === 1 ? "person" : "people"}`,
      metadata: { checked, updated, stale, noPicture },
    });
    revalidatePath("/", "layout");
  }
  const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
  const parts: string[] = [];
  if (updated > 0) parts.push(`Added the Google picture for ${people(updated)}.`);
  if (checked - updated > 0) {
    parts.push(`${people(checked - updated)} will get it when they next sign in with Google.`);
  }
  if (noPicture > 0) {
    parts.push(
      `${people(noPicture)} without a picture have no Google photo saved yet: they can sign out and back in, then use Edit profile > Use Google photo.`,
    );
  }
  if (parts.length === 0) {
    parts.push(
      "Nobody was changed: everyone with a saved Google photo already has a picture that loads. To force your own, use Edit profile > Use Google photo.",
    );
  }
  return { ok: true, message: parts.join(" ") };
}

/**
 * Hard-deletes a user when nothing references them; otherwise deactivates and
 * detaches them from their site (see deleteUser). True when archived.
 */
async function removeUserRecord(id: string): Promise<boolean> {
  // Clear both directions of the manager join: nobody should keep pointing at a
  // removed manager, and no leftover row should stand between them and the
  // hard-delete (or, in turn, between their site and its removal).
  await prisma.userManager.deleteMany({
    where: { OR: [{ userId: id }, { managerId: id }] },
  });

  let archived = false;
  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    if (!isForeignKeyError(e)) throw e;
    archived = true;
    await prisma.user.update({
      where: { id },
      data: { active: false, siteId: null },
    });
  }

  return archived;
}

/**
 * Removes a person. Hard-deletes when nothing references them so they leave
 * the directory outright and their site's user count drops. Recognitions,
 * ledger rows, redemptions and the rest all restrict the delete, so a person
 * with history is instead deactivated and detached from their site — gone from
 * the people list, and no longer blocking that site's removal.
 */
export async function deleteUser(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing user." };
  if (id === admin.id) {
    return { ok: false, error: "You can't remove your own account." };
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, siteId: true },
  });
  if (!user) return { ok: false, error: "That user no longer exists." };

  const archived = await removeUserRecord(id);

  await writeAudit({
    actor: admin,
    action: "user.deleted",
    entityType: "user",
    entityId: id,
    summary: archived
      ? `Removed user ${user.name} (${user.email}) — archived, history kept`
      : `Deleted user ${user.name} (${user.email})`,
    metadata: { email: user.email, role: user.role, archived },
    siteId: user.siteId,
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/sites");
  return {
    ok: true,
    message: archived
      ? `${user.name} removed. Their recognition history meant the record was archived, not deleted.`
      : `${user.name} removed.`,
  };
}

// ---------- Testing the first sign-in ----------

/**
 * Admin > Users: put someone back to how a brand-new account starts, to try
 * the first-sign-in experience again. The app tour opens for them on their
 * next page load, the Store and Rewards show everything as New, and (if asked)
 * the birthday step comes back.
 *
 * Their welcome points are taken back in the same transaction, so finishing
 * the tour again pays them once more and nobody ends up with extra points:
 * safe to use on real accounts on production. Their wallet can dip below zero
 * if they've already spent those points; finishing the tour brings it back.
 */
export async function restartOnboarding(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const clearBirthday = String(formData.get("clearBirthday") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing user." };

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, siteId: true },
  });
  if (!user) return { ok: false, error: "That user no longer exists." };

  const takenBack = await prisma.$transaction(async (tx) => {
    // Net welcome points they hold now (earlier restarts left a matching
    // negative row), so repeated restarts never take back more than was paid.
    const welcome = await tx.rewardLedger.aggregate({
      where: { userId: id, type: "WELCOME" },
      _sum: { amount: true },
    });
    const net = welcome._sum.amount ?? 0;
    if (net > 0) {
      await tx.rewardLedger.create({
        data: {
          userId: id,
          amount: -net,
          type: "WELCOME",
          sourceType: "onboarding",
          sourceId: id,
          note: "Welcome points taken back: app tour restarted by an admin",
        },
      });
    }
    await tx.user.update({
      where: { id },
      data: {
        onboardedAt: null,
        shopSeenAt: null,
        rewardsSeenAt: null,
        claimsSeenAt: null,
        ...(clearBirthday ? { birthday: null } : {}),
        ...(net > 0 ? { walletBalance: { decrement: net } } : {}),
      },
    });
    return Math.max(net, 0);
  });

  await writeAudit({
    actor: admin,
    action: "user.onboarding_restarted",
    entityType: "user",
    entityId: id,
    summary: `Restarted the first sign-in for ${user.name}${clearBirthday ? " (birthday cleared)" : ""}${takenBack ? `, took back ${takenBack} welcome points` : ""}`,
    metadata: { clearBirthday, takenBack },
    siteId: user.siteId,
  });
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${user.name} will see the first sign-in again on their next page load.${takenBack ? ` ${takenBack} welcome points taken back until they finish the tour.` : ""}`,
  };
}

/**
 * Admin > Users: remove every throwaway test account (lib/test-accounts.ts)
 * made with "Try as a new person" on the sign-in page. Same as removing each
 * one by hand: deleted outright, or archived if they did anything.
 */
export async function removeTestAccounts(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const tests = await prisma.user.findMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` }, siteId: { not: null } },
    select: { id: true, email: true },
  });
  const ids = tests.filter((t) => isTestEmail(t.email) && t.id !== admin.id).map((t) => t.id);
  if (ids.length === 0) return { ok: true, message: "There are no test accounts." };
  for (const id of ids) await removeUserRecord(id);
  await writeAudit({
    actor: admin,
    action: "user.deleted",
    entityType: "user",
    entityId: admin.id,
    summary: `Removed ${ids.length} test ${ids.length === 1 ? "account" : "accounts"}`,
    metadata: { ids },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/sites");
  return {
    ok: true,
    message: `Removed ${ids.length} test ${ids.length === 1 ? "account" : "accounts"}.`,
  };
}
