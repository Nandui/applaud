import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ValueSeal } from "@/components/value-seal";
import { FramedAvatar } from "@/components/user-avatar";
import { CountUp } from "@/components/fx/count-up";
import { CELEBRATION_EMOJI, CELEBRATION_LABELS, type ProfileData } from "@/lib/profile";
import { RARITY, bannerCss, frameArt, type Cosmetic, type CosmeticKind } from "@/lib/cosmetics";
import { formatNumber } from "@/lib/format";
import { isLight } from "@/lib/contrast";

/**
 * The parts of a profile's Showcase tab: what this person has earned (awards,
 * values they've been recognised for, milestones) and what they've collected
 * in the profile shop. Each is a plain titled section, like the rest of the
 * app; sections with nothing in them are left out.
 */

/** The counts under the name, in one row. */
export function ShowcaseStats({ data }: { data: ProfileData }) {
  const items = [
    { label: "Recognitions", value: data.stats.receivedCount },
    { label: "Given", value: data.stats.givenCount },
    { label: "Points earned", value: data.stats.pointsEarned },
    { label: "Awards", value: data.awards.length },
  ];
  return (
    <dl className="border-border bg-background grid grid-cols-4 rounded-2xl border py-3">
      {items.map((s, i) => (
        <div key={s.label} className={cn("flex flex-col-reverse items-center px-1 text-center", i > 0 && "border-border border-l")}>
          <dt className="text-muted mt-0.5 text-[0.7rem] leading-tight sm:text-xs">{s.label}</dt>
          <dd data-numeric className="text-lg leading-tight font-bold sm:text-xl">
            <CountUp value={s.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled block of the showcase, with an optional link on the right. */
export function ShowcaseSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: { label: string; href: string; color?: string };
  children: React.ReactNode;
}) {
  return (
    <section className="border-border border-b py-5 last:border-b-0">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[0.95rem] font-bold">
          {title}
          {count !== undefined ? (
            <span data-numeric className="text-muted ml-1.5 font-medium">
              {formatNumber(count)}
            </span>
          ) : null}
        </h2>
        {action ? (
          <Link
            href={action.href}
            className="flex items-center gap-0.5 text-sm font-semibold"
            style={action.color ? { color: action.color } : undefined}
          >
            {action.label}
            <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

type Badge = { key: string; label: string; art: React.ReactNode; note: string };

function BadgeGrid({ items }: { items: Badge[] }) {
  return (
    <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5">
      {items.map((b) => (
        <li key={b.key} className="flex min-w-0 flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center">{b.art}</span>
          <span className="mt-1.5 line-clamp-2 w-full text-xs leading-tight font-semibold">{b.label}</span>
          <span data-numeric className="text-muted mt-0.5 text-[0.7rem]">
            {b.note}
          </span>
        </li>
      ))}
    </ul>
  );
}

const times = (n: number) => (n === 1 ? "Once" : `${formatNumber(n)} times`);

/** Awards won, one badge per award with how many times and when last. */
export function AwardShelf({ data }: { data: ProfileData }) {
  const byName = new Map<string, { name: string; count: number; last: Date }>();
  for (const a of data.awards) {
    const won = new Date(a.wonAt);
    const g = byName.get(a.name);
    if (g) {
      g.count += 1;
      if (won > g.last) g.last = won;
    } else byName.set(a.name, { name: a.name, count: 1, last: won });
  }
  const items: Badge[] = [...byName.values()].map((g) => ({
    key: g.name,
    label: g.name,
    art: (
      <span
        className="flex size-14 items-center justify-center rounded-full shadow-sm"
        style={{ background: "linear-gradient(135deg, #fbbf24, #d97706)" }}
      >
        <Trophy className="size-6 text-white" />
      </span>
    ),
    note: g.count > 1 ? `${g.count}×, last ${format(g.last, "MMM yyyy")}` : format(g.last, "MMM yyyy"),
  }));
  return <BadgeGrid items={items} />;
}

/** The company values they've been recognised for, most often first. */
export function ValueShelf({ data }: { data: ProfileData }) {
  const items: Badge[] = data.valueTags.map((t) => ({
    key: t.value.id,
    label: t.value.name,
    art: <ValueSeal value={t.value} size="md" ribbon={false} />,
    note: times(t.count),
  }));
  return <BadgeGrid items={items} />;
}

/** Work anniversaries, birthdays and the like, newest first. */
export function Milestones({ data }: { data: ProfileData }) {
  return (
    <ul className="space-y-3">
      {data.celebrations.map((c) => (
        <li key={c.id} className="flex items-center gap-3">
          <span className="bg-surface flex size-10 shrink-0 items-center justify-center rounded-full text-xl">
            {CELEBRATION_EMOJI[c.type] ?? "🎉"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{CELEBRATION_LABELS[c.type] ?? c.type}</span>
            <span className="text-muted block text-xs">{format(c.occurredOn, "d MMMM yyyy")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const GROUPS: { kind: CosmeticKind; title: string }[] = [
  { kind: "frame", title: "Frames" },
  { kind: "banner", title: "Banners" },
  { kind: "theme", title: "Colours" },
];

/**
 * Everything they've picked up in the profile shop, like a Steam inventory:
 * frames shown on their own avatar, banners as strips, colours as swatches.
 * What they wear right now is marked in their colour.
 */
export function Collection({
  data,
  accent,
}: {
  data: ProfileData;
  accent: string;
}) {
  const { user, custom } = data;
  return (
    <div className="space-y-4">
      {GROUPS.map(({ kind, title }) => {
        const items = data.collection.filter((c) => c.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind}>
            <h3 className="text-muted mb-2 text-xs font-semibold">{title}</h3>
            <ul
              className={cn(
                "grid gap-2",
                kind === "banner" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-4 sm:grid-cols-6",
              )}
            >
              {items.map((item) => (
                <CollectionItem
                  key={item.id}
                  item={item}
                  wearing={custom[kind] === item.id}
                  accent={accent}
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function CollectionItem({
  item,
  wearing,
  accent,
  name,
  avatarUrl,
}: {
  item: Cosmetic;
  wearing: boolean;
  accent: string;
  name: string;
  avatarUrl: string | null;
}) {
  const rarity = RARITY[item.rarity];
  return (
    <li className="min-w-0">
      <span
        className={cn(
          "bg-surface relative block w-full overflow-hidden rounded-xl border",
          item.kind === "banner" ? "aspect-[3/1]" : "aspect-square",
          wearing ? "border-2" : "border-border",
        )}
        style={wearing ? { borderColor: accent } : undefined}
      >
        {item.kind === "frame" ? (
          <span className="flex h-full items-center justify-center">
            <FramedAvatar
              name={name}
              avatarUrl={avatarUrl}
              frame={frameArt(item)}
              className="size-11 text-sm"
              gapClassName="bg-surface"
            />
          </span>
        ) : item.kind === "banner" ? (
          <span className="absolute inset-0" style={{ background: bannerCss(item) }} />
        ) : (
          <span className="flex h-full items-center justify-center">
            <span className="size-9 rounded-full" style={{ backgroundColor: item.style ?? undefined }} />
          </span>
        )}
        {wearing ? (
          <span
            className="absolute top-1 left-1 rounded-full px-1.5 text-[0.6rem] leading-4 font-bold"
            style={{ backgroundColor: accent, color: isLight(accent) ? "#0a0a0a" : "#ffffff" }}
          >
            Wearing
          </span>
        ) : null}
      </span>
      <span className="mt-1 block truncate text-xs font-semibold">{item.name}</span>
      <span className="block text-[0.65rem] font-semibold" style={{ color: rarity.color }}>
        {rarity.label}
      </span>
    </li>
  );
}
