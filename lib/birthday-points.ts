import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Points paid on someone's birthday: the active "Birthday" rule in Admin >
 * Milestones, or 0 when that rule is switched off. Memoised per request.
 */
export const getBirthdayPoints = cache(async (): Promise<number> => {
  const rule = await prisma.milestoneRule.findFirst({
    where: { type: "birthday", active: true },
    select: { points: true },
  });
  return rule?.points ?? 0;
});
