import Link from "next/link";
import { format } from "date-fns";
import { Lock, Shield, Users, Trophy, Sparkles } from "lucide-react";
import { ValueIcon } from "@/components/value-icon";
import { tint } from "@/components/value-chip";
import { DECORATIONS, isLight, type ProfileCustom } from "@/lib/profile-custom";
import { CELEBRATION_EMOJI, CELEBRATION_LABELS, type ProfileData } from "@/lib/profile";
import { BOOSTS } from "@/lib/config";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** CSS variables that tint a whole profile page with its owner's theme. */
export function themeVars(custom: ProfileCustom): React.CSSProperties {
  return {
    "--p1": custom.theme.primary,
    "--p2": custom.theme.accent,
  } as React.CSSProperties;
}

/**
 * The banner: the owner's two theme colours as a gradient with a couple of
 * soft "blobs" (Handshake / Discord banners), tall enough for the avatar to
 * overlap its bottom edge.
 */
export function Banner({ children }: { children?: React.ReactNode }) {
  return (
    <div
      className="relative -mx-4 h-36 overflow-hidden md:mx-0 md:mt-4 md:h-44 md:rounded-3xl"
      style={{
        backgroundImage:
          "radial-gradient(60% 90% at 85% 10%, color-mix(in srgb, var(--p2) 85%, white 15%), transparent 60%), radial-gradient(70% 120% at 0% 100%, var(--p1), transparent 70%), linear-gradient(135deg, var(--p1), var(--p2))",
      }}
    >
      <div className="pt-safe absolute inset-x-0 top-0 flex items-start justify-between p-3">
        {children}
      </div>
    </div>
  );
}

/** Round frosted button that sits on the banner (back, settings). */
export const bannerButtonClass =
  "flex size-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-transform active:scale-90";

/** Discord's thought-bubble status next to the avatar. */
export function StatusBubble({ status }: { status: ProfileCustom["status"] }) {
  if (!status) return null;
  return (
    <div className="relative mt-2 max-w-[13rem] self-start">
      <span
        aria-hidden
        className="bg-surface-2 absolute -left-2 top-3 size-2.5 rounded-full"
      />
      <span aria-hidden className="bg-surface-2 absolute -left-4 top-5.5 size-1.5 rounded-full" />
      <p className="bg-surface-2 rounded-2xl px-3 py-2 text-sm leading-snug font-medium">
        {status.emoji && <span className="mr-1">{status.emoji}</span>}
        {status.text}
      </p>
    </div>
  );
}

type Badge = { key: string; label: string; node: React.ReactNode; className?: string };

/** The little badge strip under a name (Discord badges, Steam level). */
export function BadgeRow({ data }: { data: ProfileData }) {
  const { user, awards, level, valueTags } = data;
  const badges: Badge[] = [];

  badges.push({
    key: "level",
    label: `Level ${level.level}`,
    node: (
      <span data-numeric className="text-[0.7rem] font-black">
        LV {level.level}
      </span>
    ),
    className: "bg-lime text-lime-fg px-2",
  });
  if (user.role === "admin")
    badges.push({ key: "admin", label: "Admin", node: <Shield className="size-3.5" />, className: "text-primary" });
  if (user.role === "manager")
    badges.push({ key: "manager", label: "Manager", node: <Users className="size-3.5" />, className: "text-primary" });
  if (user.role === "ceo")
    badges.push({ key: "ceo", label: "CEO", node: <span>{BOOSTS.ceo.emoji}</span> });
  if (user.role === "operations")
    badges.push({ key: "ops", label: "Operations", node: <span>{BOOSTS.operations.emoji}</span> });
  if (awards.length > 0)
    badges.push({
      key: "awards",
      label: `${awards.length} award${awards.length === 1 ? "" : "s"} won`,
      node: (
        <span className="flex items-center gap-0.5 text-amber-400">
          <Trophy className="size-3.5" />
          {awards.length > 1 && <span data-numeric className="text-[0.7rem] font-bold">{awards.length}</span>}
        </span>
      ),
    });
  const top = valueTags[0];
  if (top)
    badges.push({
      key: "top-value",
      label: `Known for ${top.value.name}`,
      node: (
        <ValueIcon
          icon={top.value.icon}
          className="size-3.5"
          style={top.value.color ? { color: top.value.color } : undefined}
        />
      ),
    });
  const years = data.tenureYears;
  if (years >= 1)
    badges.push({
      key: "tenure",
      label: `${years} year${years === 1 ? "" : "s"} on the team`,
      node: <span data-numeric className="text-[0.7rem] font-bold">{years}Y</span>,
    });

  return (
    <ul className="bg-surface-2 inline-flex flex-wrap items-center gap-1 rounded-xl p-1" aria-label="Badges">
      {badges.map((b) => (
        <li
          key={b.key}
          title={b.label}
          aria-label={b.label}
          className={cn(
            "bg-surface flex h-6 min-w-6 items-center justify-center rounded-lg px-1",
            b.className,
          )}
        >
          {b.node}
        </li>
      ))}
    </ul>
  );
}

/** Steam-style level card: big level number, XP bar, next unlock. */
export function LevelCard({ data, isMe }: { data: ProfileData; isMe: boolean }) {
  const { level, unlocked } = data;
  const next = DECORATIONS.find((d) => !unlocked.has(d.id));
  return (
    <section className="bg-surface flex items-center gap-4 rounded-3xl p-4">
      <div
        className="relative flex size-16 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--p1) ${Math.round(level.progress * 360)}deg, var(--surface-3) 0deg)`,
        }}
      >
        <span className="bg-surface flex size-[3.4rem] flex-col items-center justify-center rounded-full">
          <span className="text-muted text-[0.55rem] font-bold tracking-wider uppercase">Level</span>
          <span data-numeric className="font-display -mt-0.5 text-2xl leading-none font-extrabold">
            {level.level}
          </span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          <span data-numeric>{formatNumber(level.intoLevel)}</span>
          <span className="text-muted"> / </span>
          <span data-numeric>{formatNumber(level.levelSpan)}</span>
          <span className="text-muted"> XP to level {level.level + 1}</span>
        </p>
        <div className="bg-surface-3 mt-2 h-2 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(4, Math.round(level.progress * 100))}%`,
              backgroundImage: "linear-gradient(90deg, var(--p1), var(--p2))",
            }}
          />
        </div>
        {isMe && next && (
          <p className="text-muted mt-2 flex items-center gap-1.5 text-xs">
            <Lock className="size-3" /> Next ring: <span className="text-foreground font-semibold">{next.label}</span> · {next.hint}
          </p>
        )}
        {!isMe && (
          <p className="text-muted mt-2 text-xs">
            XP comes from points earned and shout-outs sent and received.
          </p>
        )}
      </div>
    </section>
  );
}

/** "About me" card (Discord). */
export function AboutCard({ data }: { data: ProfileData }) {
  const { user, custom } = data;
  const since = user.hireDate ?? user.createdAt;
  return (
    <section className="bg-surface space-y-3 rounded-3xl p-4">
      {custom.bio && (
        <div>
          <h2 className="text-muted mb-1 text-xs font-bold tracking-wide uppercase">About me</h2>
          <p className="text-[0.95rem] leading-relaxed whitespace-pre-line">{custom.bio}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <h2 className="text-muted mb-0.5 text-xs font-bold tracking-wide uppercase">On the team since</h2>
          <p className="font-medium">{format(since, "d MMM yyyy")}</p>
        </div>
        {user.site && (
          <div>
            <h2 className="text-muted mb-0.5 text-xs font-bold tracking-wide uppercase">Site</h2>
            <p className="truncate font-medium">{user.site.name}</p>
          </div>
        )}
        {user.managers.length > 0 && (
          <div className="col-span-2">
            <h2 className="text-muted mb-0.5 text-xs font-bold tracking-wide uppercase">
              {user.managers.length === 1 ? "Manager" : "Managers"}
            </h2>
            <p className="font-medium">
              {user.managers.map((m, i) => (
                <span key={m.manager.id}>
                  {i > 0 && ", "}
                  <Link href={`/profile/${m.manager.id}`} className="hover:underline">
                    {m.manager.name}
                  </Link>
                </span>
              ))}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Trophy case (Steam showcase / Xbox achievements): awards won, value badges
 * with counts, and milestones. Values the person hasn't been recognised for
 * yet show as locked silhouettes so there's always something to chase.
 */
export function TrophyCase({
  data,
  allValues,
}: {
  data: ProfileData;
  allValues: { id: string; name: string; icon: string | null; color: string | null }[];
}) {
  const counts = new Map(data.valueTags.map((t) => [t.value.id, t.count]));
  return (
    <section className="bg-surface space-y-4 rounded-3xl p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">Trophy case</h2>
        <span className="text-muted text-xs">
          <span data-numeric>{data.valueTags.length}</span>/<span data-numeric>{allValues.length}</span> values ·{" "}
          <span data-numeric>{data.awards.length}</span> {data.awards.length === 1 ? "award" : "awards"}
        </span>
      </div>

      {data.awards.length > 0 && (
        <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
          {data.awards.map((a) => (
            <li
              key={a.id}
              className="relative flex w-36 shrink-0 flex-col justify-end overflow-hidden rounded-2xl p-3 text-white"
              style={{
                backgroundImage:
                  "radial-gradient(80% 80% at 80% 0%, rgb(253 230 138 / 0.9), transparent 60%), linear-gradient(160deg, #f59e0b, #b45309)",
              }}
            >
              <Trophy className="absolute top-2.5 right-2.5 size-10 opacity-30" aria-hidden />
              <p className="font-display text-[0.95rem] leading-tight font-bold">{a.name}</p>
              <p className="mt-0.5 text-[0.7rem] font-medium text-white/85">{format(a.wonAt, "MMM yyyy")}</p>
            </li>
          ))}
        </ul>
      )}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {allValues.map((v) => {
          const n = counts.get(v.id) ?? 0;
          const earned = n > 0;
          return (
            <li
              key={v.id}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center",
                earned ? "" : "opacity-45",
              )}
              style={{ backgroundColor: earned ? tint(v.color, 0.14) : "var(--surface-2)" }}
            >
              <span
                className="relative flex size-11 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: earned ? (v.color ?? "var(--primary)") : "var(--surface-3)",
                  color: earned ? "#fff" : "var(--muted)",
                }}
              >
                {earned ? <ValueIcon icon={v.icon} className="size-5.5" /> : <Lock className="size-4.5" />}
                {earned && (
                  <span
                    data-numeric
                    className="bg-foreground text-background ring-surface absolute -right-1.5 -bottom-1.5 min-w-5 rounded-full px-1 text-[0.65rem] font-black ring-2"
                  >
                    {n}
                  </span>
                )}
              </span>
              <span className="line-clamp-2 text-[0.7rem] leading-tight font-semibold">{v.name}</span>
            </li>
          );
        })}
      </ul>

      {data.celebrations.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {data.celebrations.map((c) => (
            <span
              key={c.id}
              className="bg-surface-2 flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-3.5 pl-2 text-sm"
            >
              <span className="text-lg leading-none">{CELEBRATION_EMOJI[c.type] ?? "🎉"}</span>
              <span className="font-semibold">{CELEBRATION_LABELS[c.type] ?? c.type}</span>
              <span className="text-muted text-xs">{format(c.occurredOn, "MMM yyyy")}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** Stat trio under the header. */
export function Stats({ data }: { data: ProfileData }) {
  const items = [
    { label: "received", value: data.stats.receivedCount },
    { label: "given", value: data.stats.givenCount },
    { label: "points earned", value: data.stats.pointsEarned },
  ];
  return (
    <dl className="flex gap-6">
      {items.map((s) => (
        <div key={s.label} className="flex flex-col-reverse">
          <dt className="text-muted text-xs">{s.label}</dt>
          <dd data-numeric className="font-display text-xl leading-tight font-extrabold">
            {formatNumber(s.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Text colour that reads on top of the owner's primary theme colour. */
export function onPrimary(custom: ProfileCustom): string {
  return isLight(custom.theme.primary) ? "#0b0b10" : "#ffffff";
}

export function EmptyShowcase({ isMe }: { isMe: boolean }) {
  if (!isMe) return null;
  return (
    <div className="border-border text-muted flex items-center gap-3 rounded-3xl border border-dashed p-4 text-sm">
      <Sparkles className="text-primary size-5 shrink-0" />
      <p>
        Pin up to 3 shout-outs you&apos;re proud of. Tap <span className="font-semibold">•••</span> on
        any you received.
      </p>
    </div>
  );
}
