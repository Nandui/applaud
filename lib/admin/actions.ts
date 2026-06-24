"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";

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
  await requireAdmin();
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
  if (id) await prisma.value.update({ where: { id }, data });
  else await prisma.value.create({ data });
  revalidatePath("/admin/values");
  revalidatePath("/recognize");
  return { ok: true, message: id ? "Value updated." : "Value created." };
}

export async function setValueActive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing value." };
  await prisma.value.update({ where: { id }, data: { active } });
  revalidatePath("/admin/values");
  return { ok: true };
}

// ---------- Sites ----------

export async function saveSite(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
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
  try {
    if (id) await prisma.site.update({ where: { id }, data });
    else await prisma.site.create({ data });
  } catch (e) {
    if (isUniqueError(e)) return { ok: false, error: "That site code is taken." };
    throw e;
  }
  revalidatePath("/admin/sites");
  return { ok: true, message: id ? "Site updated." : "Site created." };
}

export async function setSiteActive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing site." };
  await prisma.site.update({ where: { id }, data: { active } });
  revalidatePath("/admin/sites");
  return { ok: true };
}

// ---------- Users ----------

const ROLES = ["staff", "manager", "admin"];

export async function saveUser(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const role = String(formData.get("role") ?? "staff");
  const siteId = String(formData.get("siteId") ?? "").trim();
  const managerId = String(formData.get("managerId") ?? "").trim();
  const active = String(formData.get("active") ?? "true") === "true";
  const hireDate = parseDate(formData.get("hireDate"));
  const birthday = parseDate(formData.get("birthday"));

  if (name.length < 2) return { ok: false, error: "Name is too short." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (!ROLES.includes(role)) return { ok: false, error: "Invalid role." };
  if (!siteId) return { ok: false, error: "Pick a site." };
  if (managerId && managerId === id) {
    return { ok: false, error: "A user can't be their own manager." };
  }

  const data = {
    name,
    email,
    jobTitle: jobTitle || null,
    role,
    siteId,
    managerId: managerId || null,
    active,
    hireDate,
    birthday,
  };
  try {
    if (id) await prisma.user.update({ where: { id }, data });
    else await prisma.user.create({ data });
  } catch (e) {
    if (isUniqueError(e)) return { ok: false, error: "That email is already in use." };
    throw e;
  }
  revalidatePath("/admin/users");
  return { ok: true, message: id ? "User updated." : "User created." };
}

export async function setUserActive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing user." };
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/admin/users");
  return { ok: true };
}
