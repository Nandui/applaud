import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export const AUDIT_ACTIONS = [
  "recognition.created",
  "recognition.reacted",
  "recognition.commented",
  "points.boosted",
  "nomination.created",
  "nomination.reviewed",
  "reward.created",
  "reward.updated",
  "reward.archived",
  "reward.restored",
  "redemption.created",
  "redemption.approved",
  "redemption.fulfilled",
  "redemption.cancelled",
  "user.created",
  "user.updated",
  "site.created",
  "site.updated",
  "value.created",
  "value.updated",
  "award.created",
  "award.updated",
  "milestone.updated",
  "settings.updated",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditActor = {
  id: string;
  email: string;
  role: string;
};

type Db = Prisma.TransactionClient | typeof prisma;

export async function writeAudit(
  input: {
    actor?: AuditActor | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    summary: string;
    metadata?: Prisma.InputJsonValue;
    siteId?: string | null;
  },
  db: Db = prisma,
): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actorUserId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        actorRole: input.actor?.role ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata ?? undefined,
        siteId: input.siteId ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write event", input.action, err);
  }
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "recognition.created": "Recognition created",
  "recognition.reacted": "Reaction",
  "recognition.commented": "Comment",
  "points.boosted": "Points boosted",
  "nomination.created": "Nomination created",
  "nomination.reviewed": "Nomination reviewed",
  "reward.created": "Reward created",
  "reward.updated": "Reward updated",
  "reward.archived": "Reward hidden",
  "reward.restored": "Reward restored",
  "redemption.created": "Redemption requested",
  "redemption.approved": "Redemption approved",
  "redemption.fulfilled": "Redemption fulfilled",
  "redemption.cancelled": "Redemption cancelled",
  "user.created": "User created",
  "user.updated": "User updated",
  "site.created": "Site created",
  "site.updated": "Site updated",
  "value.created": "Value created",
  "value.updated": "Value updated",
  "award.created": "Award program created",
  "award.updated": "Award program updated",
  "milestone.updated": "Milestone updated",
  "settings.updated": "Settings updated",
};
