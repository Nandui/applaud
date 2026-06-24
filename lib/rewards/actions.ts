"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth/guards";
import { getFulfilmentAdapter } from "@/lib/rewards/adapter";

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

  try {
    await prisma.$transaction(async (tx) => {
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
    });
  } catch (error) {
    if (error instanceof RedeemError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/rewards");
  revalidatePath("/me");
  revalidatePath("/admin/redemptions");
  return { ok: true, message: "Reward requested! An admin will fulfil it soon." };
}

// ---------- Catalogue CRUD (admin) ----------

function parseRewardForm(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim();
  const category = String(fd.get("category") ?? "").trim();
  const pointsCost = Math.floor(Number(fd.get("pointsCost")));
  const stockRaw = String(fd.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? null : Math.max(0, Math.floor(Number(stockRaw)));
  const siteId = String(fd.get("siteId") ?? "").trim() || null;
  const active = String(fd.get("active") ?? "true") === "true";
  return { name, description, category, pointsCost, stock, siteId, active };
}

function validateReward(d: ReturnType<typeof parseRewardForm>): string | null {
  if (d.name.length < 2) return "Name is too short.";
  if (!Number.isFinite(d.pointsCost) || d.pointsCost < 0) return "Enter a valid points cost.";
  if (d.stock !== null && (!Number.isFinite(d.stock) || d.stock < 0))
    return "Enter a valid stock value.";
  return null;
}

export async function createReward(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const d = parseRewardForm(formData);
  const err = validateReward(d);
  if (err) return { ok: false, error: err };

  await prisma.reward.create({
    data: {
      name: d.name,
      description: d.description || null,
      category: d.category || null,
      pointsCost: d.pointsCost,
      stock: d.stock,
      siteId: d.siteId,
      active: d.active,
    },
  });
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return { ok: true, message: "Reward created." };
}

export async function updateReward(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing reward." };
  const d = parseRewardForm(formData);
  const err = validateReward(d);
  if (err) return { ok: false, error: err };

  await prisma.reward.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description || null,
      category: d.category || null,
      pointsCost: d.pointsCost,
      stock: d.stock,
      siteId: d.siteId,
      active: d.active,
    },
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
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing reward." };
  await prisma.reward.update({ where: { id }, data: { active } });
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return { ok: true };
}

// ---------- Fulfilment queue (admin) ----------

export async function approveRedemption(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const r = await prisma.redemption.findUnique({ where: { id } });
  if (!r || r.status !== "requested") {
    return { ok: false, error: "This redemption can't be approved." };
  }
  await prisma.redemption.update({ where: { id }, data: { status: "approved" } });
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

  revalidatePath("/admin/redemptions");
  revalidatePath("/rewards");
  revalidatePath("/me");
  return { ok: true, message: "Cancelled and refunded." };
}
