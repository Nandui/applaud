"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { requireUser, requireManager, requireAdmin } from "@/lib/auth/guards";
import { isAdmin } from "@/lib/auth/types";
import { writeAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

type Tx = Prisma.TransactionClient;

/**
 * Apply an award: post a system recognition to the feed, credit the nominee
 * via an AWARD ledger row (+ cached wallet), and mark the nomination approved.
 * Runs inside a transaction.
 */
async function applyAward(
  tx: Tx,
  nomination: { id: string; nomineeId: string; nomineeName: string },
  program: { name: string; points: number },
  reviewerId: string,
) {
  const post = await tx.recognition.create({
    data: {
      senderId: reviewerId,
      system: true,
      message: `🏆 ${nomination.nomineeName} won ${program.name}!`,
      recipients: { create: [{ userId: nomination.nomineeId, points: 0 }] },
    },
  });

  if (program.points > 0) {
    await tx.rewardLedger.create({
      data: {
        userId: nomination.nomineeId,
        amount: program.points,
        type: "AWARD",
        sourceType: "nomination",
        sourceId: post.id,
        note: `Won ${program.name}`,
      },
    });
    await tx.user.update({
      where: { id: nomination.nomineeId },
      data: { walletBalance: { increment: program.points } },
    });
  }

  await tx.nomination.update({
    where: { id: nomination.id },
    data: {
      status: "approved",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      pointsAwarded: program.points,
    },
  });
}

const nominateSchema = z.object({
  programId: z.string().min(1, "Pick a program."),
  nomineeId: z.string().min(1, "Pick a colleague."),
  justification: z.string().trim().min(10, "Add a justification (10+ chars).").max(800),
});

export async function nominate(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = nominateSchema.safeParse({
    programId: formData.get("programId"),
    nomineeId: formData.get("nomineeId"),
    justification: formData.get("justification"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { programId, nomineeId, justification } = parsed.data;

  if (nomineeId === me.id) {
    return { ok: false, error: "You can't nominate yourself." };
  }

  const [program, nominee] = await Promise.all([
    prisma.awardProgram.findFirst({ where: { id: programId, active: true } }),
    prisma.user.findFirst({
      where: { id: nomineeId, active: true },
      select: { id: true, name: true },
    }),
  ]);
  if (!program) return { ok: false, error: "That program is unavailable." };
  if (!nominee) return { ok: false, error: "That colleague is unavailable." };

  if (program.requiresApproval) {
    const nom = await prisma.nomination.create({
      data: { programId, nominatorId: me.id, nomineeId, justification, status: "pending" },
    });
    await writeAudit({
      actor: me,
      action: "nomination.created",
      entityType: "nomination",
      entityId: nom.id,
      summary: `Nominated ${nominee.name} for ${program.name}`,
      metadata: { programId, nomineeId, status: "pending" },
      siteId: me.siteId,
    });
    revalidatePath("/awards");
    revalidatePath("/admin/nominations");
    return { ok: true, message: "Nomination submitted for approval." };
  }

  // Auto-approve programs award immediately.
  let nomId: string | undefined;
  await prisma.$transaction(async (tx) => {
    const nom = await tx.nomination.create({
      data: { programId, nominatorId: me.id, nomineeId, justification, status: "pending" },
    });
    nomId = nom.id;
    await applyAward(
      tx,
      { id: nom.id, nomineeId, nomineeName: nominee.name },
      { name: program.name, points: program.points },
      me.id,
    );
  });
  await writeAudit({
    actor: me,
    action: "nomination.created",
    entityType: "nomination",
    entityId: nomId,
    summary: `Nominated ${nominee.name} for ${program.name} (auto-approved)`,
    metadata: { programId, nomineeId, status: "approved", auto: true, points: program.points },
    siteId: me.siteId,
  });
  revalidatePath("/awards");
  revalidatePath("/");
  return { ok: true, message: `Awarded! ${nominee.name} received ${program.points} pts.` };
}

async function loadReviewable(id: string) {
  return prisma.nomination.findUnique({
    where: { id },
    include: {
      nominee: { select: { id: true, name: true, managerId: true } },
      program: { select: { name: true, points: true } },
    },
  });
}

export async function approveNomination(formData: FormData): Promise<ActionResult> {
  const reviewer = await requireManager();
  const id = String(formData.get("id") ?? "");
  const nomination = await loadReviewable(id);
  if (!nomination || nomination.status !== "pending") {
    return { ok: false, error: "This nomination can't be approved." };
  }
  if (!isAdmin(reviewer) && nomination.nominee.managerId !== reviewer.id) {
    return { ok: false, error: "You can only review your own reports." };
  }

  await prisma.$transaction(async (tx) => {
    await applyAward(
      tx,
      {
        id: nomination.id,
        nomineeId: nomination.nomineeId,
        nomineeName: nomination.nominee.name,
      },
      { name: nomination.program.name, points: nomination.program.points },
      reviewer.id,
    );
  });
  await writeAudit({
    actor: reviewer,
    action: "nomination.reviewed",
    entityType: "nomination",
    entityId: nomination.id,
    summary: `Approved nomination of ${nomination.nominee.name} for ${nomination.program.name}`,
    metadata: { status: "approved", points: nomination.program.points },
    siteId: reviewer.siteId,
  });
  revalidatePath("/admin/nominations");
  revalidatePath("/awards");
  revalidatePath("/");
  return { ok: true, message: "Approved — nominee credited and posted to the feed." };
}

export async function rejectNomination(formData: FormData): Promise<ActionResult> {
  const reviewer = await requireManager();
  const id = String(formData.get("id") ?? "");
  const nomination = await loadReviewable(id);
  if (!nomination || nomination.status !== "pending") {
    return { ok: false, error: "This nomination can't be rejected." };
  }
  if (!isAdmin(reviewer) && nomination.nominee.managerId !== reviewer.id) {
    return { ok: false, error: "You can only review your own reports." };
  }

  await prisma.nomination.update({
    where: { id },
    data: { status: "rejected", reviewedById: reviewer.id, reviewedAt: new Date() },
  });
  await writeAudit({
    actor: reviewer,
    action: "nomination.reviewed",
    entityType: "nomination",
    entityId: nomination.id,
    summary: `Rejected nomination of ${nomination.nominee.name} for ${nomination.program.name}`,
    metadata: { status: "rejected" },
    siteId: reviewer.siteId,
  });
  revalidatePath("/admin/nominations");
  revalidatePath("/awards");
  return { ok: true, message: "Nomination rejected." };
}

// ---------- Award program CRUD (admin) ----------

function parseProgramForm(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim();
  const points = Math.floor(Number(fd.get("points")));
  const cadenceRaw = String(fd.get("cadence") ?? "").trim();
  const cadence = cadenceRaw === "" || cadenceRaw === "adhoc" ? null : cadenceRaw;
  const requiresApproval = String(fd.get("requiresApproval") ?? "true") === "true";
  const active = String(fd.get("active") ?? "true") === "true";
  return { name, description, points, cadence, requiresApproval, active };
}

export async function saveAwardProgram(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const d = parseProgramForm(formData);
  if (d.name.length < 2) return { ok: false, error: "Name is too short." };
  if (!Number.isFinite(d.points) || d.points < 0) {
    return { ok: false, error: "Enter a valid points value." };
  }

  const data = {
    name: d.name,
    description: d.description || null,
    points: d.points,
    cadence: d.cadence,
    requiresApproval: d.requiresApproval,
    active: d.active,
  };
  let entityId = id;
  if (id) await prisma.awardProgram.update({ where: { id }, data });
  else {
    const created = await prisma.awardProgram.create({ data });
    entityId = created.id;
  }
  await writeAudit({
    actor: admin,
    action: id ? "award.updated" : "award.created",
    entityType: "award_program",
    entityId,
    summary: id ? `Updated award program ${d.name}` : `Created award program ${d.name}`,
    metadata: { points: d.points, active: d.active, cadence: d.cadence },
  });
  revalidatePath("/admin/awards");
  revalidatePath("/awards");
  return { ok: true, message: id ? "Program updated." : "Program created." };
}

export async function setAwardProgramActive(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, error: "Missing program." };
  await prisma.awardProgram.update({ where: { id }, data: { active } });
  await writeAudit({
    actor: admin,
    action: "award.updated",
    entityType: "award_program",
    entityId: id,
    summary: active ? "Reactivated an award program" : "Deactivated an award program",
    metadata: { active },
  });
  revalidatePath("/admin/awards");
  revalidatePath("/awards");
  return { ok: true };
}
