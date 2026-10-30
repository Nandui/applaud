import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { AppBar } from "@/components/app-shell/app-bar";
import { BackButton } from "@/components/app-shell/back-button";
import { ClaimCard, type ClaimCardData } from "@/components/rewards/claim-card";
import { isOpenClaim, isOverdue } from "@/lib/fulfilment";

export const dynamic = "force-dynamic";
export const metadata = { title: "My rewards" };

/**
 * Everything this person has claimed with points: what's on the way (with the
 * date it was promised by and where it's up to), then what's done.
 */
export default async function ClaimedRewardsPage() {
  const me = await requireUser();
  const redemptions = await prisma.redemption.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      pointsCost: true,
      createdAt: true,
      approvedAt: true,
      fulfilledAt: true,
      expectedBy: true,
      fulfilmentLabel: true,
      staffNote: true,
      reward: { select: { name: true, imageUrl: true, fulfilmentUnit: true } },
    },
  });

  const now = new Date();
  const claims: ClaimCardData[] = redemptions.map((r) => ({
    id: r.id,
    status: r.status,
    pointsCost: r.pointsCost,
    createdAt: r.createdAt.toISOString(),
    approvedAt: r.approvedAt?.toISOString() ?? null,
    fulfilledAt: r.fulfilledAt?.toISOString() ?? null,
    expectedBy: r.expectedBy?.toISOString() ?? null,
    withTime: r.reward.fulfilmentUnit === "hours",
    fulfilmentLabel: r.fulfilmentLabel,
    overdue: isOverdue(r, now),
    staffNote: r.staffNote,
    reward: { name: r.reward.name, imageUrl: r.reward.imageUrl },
  }));
  const open = claims.filter((c) => isOpenClaim(c.status));
  const done = claims.filter((c) => !isOpenClaim(c.status));

  return (
    <div className="mx-auto max-w-xl">
      <AppBar title="My rewards" center leading={<BackButton fallback="/rewards" />} />

      {claims.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-4xl">🎁</span>
          <p className="text-foreground font-bold">Nothing claimed yet</p>
          <p className="text-sm">Rewards you claim show up here, with where each one is up to.</p>
          <Link href="/rewards" className="bg-primary text-primary-fg mt-3 rounded-xl px-5 py-3 font-bold">
            Browse rewards
          </Link>
        </div>
      ) : (
        <div className="space-y-7 pt-2">
          {open.length > 0 ? (
            <section aria-labelledby="open-heading">
              <h2 id="open-heading" className="mb-2 text-[0.95rem] font-bold">
                On the way
              </h2>
              <div className="space-y-3">
                {open.map((c) => (
                  <ClaimCard key={c.id} claim={c} />
                ))}
              </div>
            </section>
          ) : null}
          {done.length > 0 ? (
            <section aria-labelledby="done-heading">
              <h2 id="done-heading" className="mb-2 text-[0.95rem] font-bold">
                Done
              </h2>
              <div className="space-y-3">
                {done.map((c) => (
                  <ClaimCard key={c.id} claim={c} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
