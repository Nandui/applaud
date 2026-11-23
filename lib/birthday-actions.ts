"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { checkBirthday, formatBirthday } from "@/lib/birthday";

export type SetBirthdayResult = { ok: true; birthday: string } | { ok: false; error: string };

/**
 * The signed-in person adds their own date of birth. Only once: the update
 * only matches while their birthday is still empty, so a second tab or a
 * replayed request can't change it. Admins correct it in Admin > Users.
 */
export async function setMyBirthday(iso: string): Promise<SetBirthdayResult> {
  const me = await requireUser();
  const checked = checkBirthday(String(iso ?? ""));
  if (!checked.ok) return checked;

  const updated = await prisma.user.updateMany({
    where: { id: me.id, birthday: null },
    data: { birthday: checked.date },
  });
  if (updated.count !== 1) {
    return {
      ok: false,
      error: "Your birthday is already saved. Ask an admin if it needs changing.",
    };
  }

  await writeAudit({
    actor: me,
    action: "user.birthday_set",
    entityType: "user",
    entityId: me.id,
    // Day and month only: the audit log is wider than the people who need the year.
    summary: `Added their birthday (${formatBirthday(checked.date, false)})`,
    siteId: me.siteId,
  });
  revalidatePath("/", "layout");
  return { ok: true, birthday: checked.date.toISOString().slice(0, 10) };
}
