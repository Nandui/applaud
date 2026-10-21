"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth/guards";
import { getFulfilmentAdapter } from "@/lib/rewards/adapter";
import { isProjectBlobUrl } from "@/lib/blob";
import { writeAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

class RedeemError extends Error {}

// ---------- Redeem (staff) ----------

const redeemSchema = z.object({ rewardId: z.string().min(1) });

export async function redeemReward(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = redeemSchema.safeParse({ rewardId: formData.get("rewardId") });
  if (!parsed.success) return { ok: false, error: "Invalid reward." };
  const { rewardId } = parsed.data;

  let redeemed: { id: string; name: string; pointsCost: number };
  try {
    redeemed = await prisma.$transaction(async (tx) => {
      const reward = await tx.reward.findUnique({ where: { id: rewardId } });
      if (!reward || !reward.active) {
        throw new RedeemError("This reward isn't available.");
      }
      if (reward.siteId && reward.siteId !== me.siteId) {
        throw new RedeemError("This reward isn't available at your site.");
      }

      // Live balance from the ledger (source of truth), checked in-transaction.
      const agg = await tx.rewardLedger.aggregate({
        _sum: { amount: true },
        where: { userId: me.id },
      });
      const balance = agg._sum.amount ?? 0;
      if (balance < reward.pointsCost) {
        throw new RedeemError("You don't have enough points for this reward.");
      }

      // Atomic stock guard: only decrement if still in stock.
      if (reward.stock !== null) {
        const dec = await tx.reward.updateMany({
          where: { id: rewardId, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (dec.count === 0) {
          throw new RedeemError("This reward is out of stock.");
        }
      }

      const redemption = await tx.redemption.create({
        data: {
          userId: me.id,
          rewardId,
          pointsCost: reward.pointsCost, // captured at redemption time
          status: "requested",
        },
      });
      await tx.rewardLedger.create({
        data: {
          userId: me.id,
          amount: -reward.pointsCost,
          type: "REDEMPTION",
          sourceType: "redemption",
          sourceId: redemption.id,
          note: `Redeemed ${reward.name}`,
        },
      });
      await tx.user.update({
        where: { id: me.id },
        data: { walletBalance: { decrement: reward.pointsCost } },
      });
      return { id: redemption.id, name: reward.name, pointsCost: reward.pointsCost };
    });
  } catch (error) {
    if (error instanceof RedeemError) return { ok: false, error: error.message };
    throw error;
  }

  await writeAudit({
    actor: me,
    action: "redemption.created",
    entityType: "redemption",
    entityId: redeemed.id,
    summary: `Requested ${redeemed.name} (${redeemed.pointsCost} pts)`,
    metadata: { rewardId, pointsCost: redeemed.pointsCost },
    siteId: me.siteId,
  });
  revalidatePath("/rewards");
  revalidatePath("/me");
  revalidatePath("/admin/redemptions");
  return { ok: true, message: "Reward requested! An admin will fulfil it soon." };
}

// ---------- Catalogue CRUD (admin) ----------

const FULFILMENT_TYPES = new Set(["manual"]);

function parseRewardForm(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim();
  const category = String(fd.get("category") ?? "").trim();
  const imageUrl = String(fd.get("imageUrl") ?? "").trim();
  const pointsCost = Math.floor(Number(fd.get("pointsCost")));
  const stockRaw = String(fd.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? null : Math.max(0, Math.floor(Number(stockRaw)));
  const siteId = String(fd.get("siteId") ?? "").trim() || null;
  const active = String(fd.get("active") ?? "true") === "true";
  const fulfilment = String(fd.get("fulfilment") ?? "manual").trim() || "manual";
  const type = "internal";
  const sortRaw = String(fd.get("sortOrder") ?? "").trim();
  const sortOrder = sortRaw === "" ? 0 : Math.floor(Number(sortRaw));
  return {
    name,
    description,
    category,
    imageUrl,
    pointsCost,
    stock,
    siteId,
    active,
    fulfilment,
    type,
    sortOrder,
  };
}

function validateReward(d: ReturnType<typeof parseRewardForm>): string | null {
  if (d.name.length < 2) return "Name is too short.";
  if (!Number.isFinite(d.pointsCost) || d.pointsCost < 0) return "Enter a valid points cost.";
  if (d.stock !== null && (!Number.isFinite(d.stock) || d.stock < 0))
    return "Enter a valid stock value.";
  if (!Number.isFinite(d.sortOrder)) return "Enter a valid sort order.";
  if (d.imageUrl && !isProjectBlobUrl(d.imageUrl)) return "Unrecognised picture URL.";
  if (!FULFILMENT_TYPES.has(d.fulfilment)) return "Only manual fulfilment is supported.";
  return null;
}

function rewardData(d: ReturnType<typeof parseRewardForm>) {
  return {
    name: d.name,
    description: d.description || null,
    category: d.category || null,
    imageUrl: d.imageUrl || null,
    pointsCost: d.pointsCost,
    stock: d.stock,
    siteId: d.siteId,
    active: d.active,
    fulfilment: d.fulfilment,
    type: d.type,
    sortOrder: d.sortOrder,
  };
}

export async function createReward(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const d = parseRewardForm(formData);
  const err = validateReward(d);
  if (err) return { ok: false, error: err };

  const created = await prisma.reward.create({ data: rewardData(d) });
  await writeAudit({
    actor: admin,
    action: "reward.created",
    entityType: "reward",
    entityId: created.id,
    summary: `Created reward ${d.name} (${d.pointsCost} pts)`,
    metadata: { pointsCost: d.pointsCost, stock: d.stock, active: d.active, sortOrder: d.sortOrder },
    siteId: d.siteId,
  });
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return { ok: true, message: "Reward created." };
}

export async function updateReward(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing reward." };
  const d = parseRewardForm(formData);
  const err = validateReward(d);
  if (err) return { ok: false, error: err };

  await prisma.reward.update({ where: { id }, data: rewardData(d) });
  await writeAudit({
    actor: admin,
    action: "reward.updated",
    entityType: "reward",
    entityId: id,
    summary: `Updated reward ${d.name}`,
    metadata: { pointsCost: d.pointsCost, stock: d.stock, active: d.active, sortOrder: d.sortOrder },
    siteId: d.siteId,
  });
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return { ok: true, message: "Reward updated." };
}

/** Create or update depending on whether an `id` is present. */
export async function saveReward(
  prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  return id ? updateReward(prev, formData) : createReward(prev, formData);
}

export async function setRewardActive(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing reward." };
  const reward = await prisma.reward.update({ where: { id }, data: { active } });
  await writeAudit({
    actor: admin,
    action: active ? "reward.restored" : "reward.archived",
    entityType: "reward",
    entityId: id,
    summary: active ? `Restored ${reward.name} to the store` : `Hid ${reward.name} from the store`,
    metadata: { active },
    siteId: reward.siteId,
  });
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return { ok: true };
}

export async function reorderReward(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Invalid reorder." };
  }
  const current = await prisma.reward.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Missing reward." };

  const neighbor = await prisma.reward.findFirst({
    where:
      direction === "up"
        ? { sortOrder: { lt: current.sortOrder } }
        : { sortOrder: { gt: current.sortOrder } },
    orderBy:
      direction === "up"
        ? [{ sortOrder: "desc" }, { name: "desc" }]
        : [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const nextOrder = neighbor
    ? neighbor.sortOrder
    : direction === "up"
      ? current.sortOrder - 1
      : current.sortOrder + 1;
  if (neighbor) {
    await prisma.$transaction([
      prisma.reward.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } }),
      prisma.reward.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } }),
    ]);
  } else {
    await prisma.reward.update({ where: { id }, data: { sortOrder: nextOrder } });
  }
  await writeAudit({
    actor: admin,
    action: "reward.updated",
    entityType: "reward",
    entityId: id,
    summary: `Reordered ${current.name} ${direction}`,
    metadata: { direction, sortOrder: nextOrder },
    siteId: current.siteId,
  });
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return { ok: true };
}

// ---------- Fulfilment queue (admin) ----------

export async function approveRedemption(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const r = await prisma.redemption.findUnique({ where: { id } });
  if (!r || r.status !== "requested") {
    return { ok: false, error: "This redemption can't be approved." };
  }
  await prisma.redemption.update({ where: { id }, data: { status: "approved" } });
  await writeAudit({
    actor: admin,
    action: "redemption.approved",
    entityType: "redemption",
    entityId: id,
    summary: "Approved a redemption",
    metadata: { rewardId: r.rewardId, userId: r.userId, pointsCost: r.pointsCost },
  });
  revalidatePath("/admin/redemptions");
  return { ok: true, message: "Approved." };
}

export async function fulfilRedemption(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const r = await prisma.redemption.findUnique({
    where: { id },
    include: { reward: true },
  });
  if (!r || (r.status !== "approved" && r.status !== "requested")) {
    return { ok: false, error: "This redemption can't be fulfilled." };
  }

  const adapter = getFulfilmentAdapter(r.reward);
  const result = await adapter.fulfil({
    id: r.id,
    rewardId: r.rewardId,
    userId: r.userId,
    pointsCost: r.pointsCost,
  });
  if (!result.ok) return { ok: false, error: result.error };

  await prisma.redemption.update({
    where: { id },
    data: {
      status: "fulfilled",
      fulfilledById: admin.id,
      fulfilledAt: new Date(),
      notes: result.reference ? `Ref: ${result.reference}` : r.notes,
    },
  });
  await writeAudit({
    actor: admin,
    action: "redemption.fulfilled",
    entityType: "redemption",
    entityId: id,
    summary: `Fulfilled ${r.reward.name} (${r.pointsCost} pts)`,
    metadata: { rewardId: r.rewardId, userId: r.userId, pointsCost: r.pointsCost },
  });
  revalidatePath("/admin/redemptions");
  return { ok: true, message: "Fulfilled." };
}

export async function cancelRedemption(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.redemption.findUnique({
        where: { id },
        include: { reward: true },
      });
      if (!r) throw new RedeemError("Redemption not found.");
      if (r.status === "cancelled") throw new RedeemError("Already cancelled.");
      if (r.status === "fulfilled")
        throw new RedeemError("Can't cancel a fulfilled redemption.");

      // Refund the captured cost as an ADJUSTMENT (ledger is append-only).
      await tx.rewardLedger.create({
        data: {
          userId: r.userId,
          amount: r.pointsCost,
          type: "ADJUSTMENT",
          sourceType: "redemption",
          sourceId: r.id,
          note: `Refund — ${r.reward.name} redemption cancelled`,
        },
      });
      await tx.user.update({
        where: { id: r.userId },
        data: { walletBalance: { increment: r.pointsCost } },
      });
      // Restock if the reward tracks finite stock.
      if (r.reward.stock !== null) {
        await tx.reward.update({
          where: { id: r.rewardId },
          data: { stock: { increment: 1 } },
        });
      }
      await tx.redemption.update({
        where: { id },
        data: {
          status: "cancelled",
          fulfilledById: admin.id,
          fulfilledAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (error instanceof RedeemError) return { ok: false, error: error.message };
    throw error;
  }

  await writeAudit({
    actor: admin,
    action: "redemption.cancelled",
    entityType: "redemption",
    entityId: id,
    summary: "Cancelled a redemption and refunded points",
  });
  revalidatePath("/admin/redemptions");
  revalidatePath("/rewards");
  revalidatePath("/me");
  return { ok: true, message: "Cancelled and refunded." };
}
