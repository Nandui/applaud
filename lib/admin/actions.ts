"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { isProjectBlobUrl } from "@/lib/blob";
import { MANAGER_GROUP_IDS } from "@/lib/config";
import { writeAudit } from "@/lib/audit";

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
  const icon = String(formData.get("icon") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const order = Math.floor(Number(formData.get("order") ?? 0));
  const active = String(formData.get("active") ?? "true") === "true";
  if (name.length < 2) return { ok: false, error: "Name is too short." };

  const data = {
    name,
    description: description || null,
    icon: icon || null,
    color: color || null,
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
  const siteId = String(formData.get("siteId") ?? "").trim();
  const managerId = String(formData.get("managerId") ?? "").trim();
  const managerGroup = String(formData.get("managerGroup") ?? "").trim();
  const active = String(formData.get("active") ?? "true") === "true";
  const hireDate = parseDate(formData.get("hireDate"));
  const birthday = parseDate(formData.get("birthday"));
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();

  if (name.length < 2) return { ok: false, error: "Name is too short." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (!ROLES.includes(role)) return { ok: false, error: "Invalid role." };
  if (!siteId) return { ok: false, error: "Pick a site." };
  if (managerId && managerId === id) {
    return { ok: false, error: "A user can't be their own manager." };
  }
  // The manager is a named person or a group rota — never both.
  if (managerGroup && !(MANAGER_GROUP_IDS as string[]).includes(managerGroup)) {
    return { ok: false, error: "Unknown manager group." };
  }
  if (managerGroup && managerId) {
    return { ok: false, error: "Pick a person or a manager group, not both." };
  }
  if (avatarUrl && !isProjectBlobUrl(avatarUrl)) {
    return { ok: false, error: "Unrecognised picture URL." };
  }

  const data = {
    name,
    email,
    jobTitle: jobTitle || null,
    role,
    siteId,
    managerId: managerId || null,
    managerGroup: managerGroup || null,
    active,
    hireDate,
    birthday,
    avatarUrl: avatarUrl || null,
  };
  let entityId = id;
  try {
    if (id) await prisma.user.update({ where: { id }, data });
    else {
      const created = await prisma.user.create({ data });
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
      siteId,
      active,
      jobTitle: jobTitle || null,
      manager: managerGroup || managerId || null,
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

  // Reports would block the delete on their own, and either way nobody should
  // keep pointing at a removed manager.
  await prisma.user.updateMany({ where: { managerId: id }, data: { managerId: null } });

  let archived = false;
  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    if (!isForeignKeyError(e)) throw e;
    archived = true;
    await prisma.user.update({
      where: { id },
      data: { active: false, siteId: null, managerId: null, managerGroup: null },
    });
  }

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
