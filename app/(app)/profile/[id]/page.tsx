import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  Briefcase,
  CalendarDays,
  Inbox,
  Send,
  Coins,
  PartyPopper,
} from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getProfileData, CELEBRATION_LABELS } from "@/lib/profile";
import { getReceivedCards } from "@/lib/recognition/queries";
import { formatNumber } from "@/lib/format";
import { UserAvatar } from "@/components/user-avatar";
import { ValueChip } from "@/components/value-chip";
import { RecognitionCard } from "@/components/feed/recognition-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getProfileData(id);
  return { title: data ? data.user.name : "Profile" };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUser();
  const data = await getProfileData(id);
  if (!data) notFound();

  const { user, stats, valueTags, celebrations } = data;
  const received = await getReceivedCards(id, viewer.id);
  const memberSince = user.hireDate ?? user.createdAt;

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <UserAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              className="size-20 text-lg"
            />
            <div>
              <h1 className="font-display text-xl font-semibold">{user.name}</h1>
              <Badge variant="secondary" className="mt-1 capitalize">
                {user.role}
              </Badge>
            </div>
            <dl className="text-muted w-full space-y-2 text-sm">
              {user.jobTitle && (
                <div className="flex items-center justify-center gap-2">
                  <Briefcase className="size-4" /> {user.jobTitle}
                </div>
              )}
              <div className="flex items-center justify-center gap-2">
                <Building2 className="size-4" /> {user.site.name}
              </div>
              <div className="flex items-center justify-center gap-2">
                <CalendarDays className="size-4" /> Since{" "}
                {format(memberSince, "MMM yyyy")}
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <Stat icon={<Inbox className="size-4" />} value={stats.receivedCount} label="received" />
            <Stat icon={<Coins className="size-4" />} value={stats.pointsEarned} label="points" />
            <Stat icon={<Send className="size-4" />} value={stats.givenCount} label="given" />
          </CardContent>
        </Card>

        {/* Value tags */}
        {valueTags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recognised for</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {valueTags.map((t) => (
                <span key={t.value.id} className="inline-flex items-center gap-1">
                  <ValueChip value={t.value} />
                  <span data-numeric className="text-muted text-xs">
                    ×{t.count}
                  </span>
                </span>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        {celebrations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {celebrations.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 text-sm">
                    <span className="bg-accent/10 text-accent flex size-8 shrink-0 items-center justify-center rounded-full">
                      <PartyPopper className="size-4" />
                    </span>
                    <div>
                      <p className="font-medium">
                        {CELEBRATION_LABELS[c.type] ?? c.type}
                      </p>
                      <p className="text-muted text-xs">
                        {format(c.occurredOn, "d MMM yyyy")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Received recognitions */}
      <div>
        <h2 className="font-display mb-4 text-lg font-semibold">
          Recognition received
        </h2>
        {received.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-muted py-12 text-center text-sm">
              No recognition to show yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {received.map((card, i) => (
              <RecognitionCard key={card.id} card={card} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-muted">{icon}</span>
      <span data-numeric className="text-lg font-semibold">
        {formatNumber(value)}
      </span>
      <span className="text-muted text-xs">{label}</span>
    </div>
  );
}
