import Link from "next/link";
import { cn } from "@/lib/utils";
import { AwardBadge, ValueSeal } from "@/components/value-seal";
import { CELEBRATION_EMOJI, CELEBRATION_LABELS, type ProfileData } from "@/lib/profile";
import { CountUp } from "@/components/fx/count-up";

/** Instagram's three counts beside the avatar, easing up as the page opens. */
export function Stats({ data }: { data: ProfileData }) {
  const items = [
    { label: "received", value: data.stats.receivedCount },
    { label: "given", value: data.stats.givenCount },
    { label: "points", value: data.stats.pointsEarned },
  ];
  return (
    <dl className="grid flex-1 grid-cols-3 text-center">
      {items.map((s) => (
        <div key={s.label} className="flex flex-col-reverse">
          <dt className="text-sm">{s.label}</dt>
          <dd data-numeric className="text-lg leading-tight font-bold">
            <CountUp value={s.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

type Highlight = {
  key: string;
  label: string;
  circle: React.ReactNode;
  background: string;
  count?: number;
  /** Badge brings its own shape (value hexagons): no circle around it. */
  bare?: boolean;
};

/**
 * Badge shelves under the bio: the awards this person has won (gold holo
 * hexagons, one per award with how many times), then the values they've been
 * recognised for and their milestones.
 */
export function Highlights({ data }: { data: ProfileData }) {
  const awardMap = new Map<string, Highlight>();
  for (const a of data.awards) {
    const h = awardMap.get(a.programId);
    if (h) h.count = (h.count ?? 1) + 1;
    else
      awardMap.set(a.programId, {
        key: `award-${a.programId}`,
        label: a.name,
        circle: <AwardBadge award={a} size="md" />,
        background: "transparent",
        bare: true,
        count: 1,
      });
  }
  const awards = [...awardMap.values()];
  const badges: Highlight[] = [
    ...data.valueTags.map((t) => ({
      key: `value-${t.value.id}`,
      label: t.value.name,
      circle: <ValueSeal value={t.value} size="md" ribbon={false} />,
      background: "transparent",
      bare: true,
      count: t.count,
    })),
    ...data.celebrations.map((c) => ({
      key: `celebration-${c.id}`,
      label: CELEBRATION_LABELS[c.type] ?? c.type,
      circle: <span className="text-2xl leading-none">{CELEBRATION_EMOJI[c.type] ?? "🎉"}</span>,
      background: "var(--surface-2)",
    })),
  ];
  if (awards.length === 0 && badges.length === 0) return null;

  return (
    <div className="space-y-3">
      {awards.length > 0 && <HighlightRow title="Awards" items={awards} />}
      {badges.length > 0 && <HighlightRow title="Recognised for" items={badges} />}
    </div>
  );
}

function HighlightRow({ title, items }: { title: string; items: Highlight[] }) {
  return (
    <section aria-label={title}>
      <h2 className="text-muted mb-2 text-[0.7rem] font-semibold tracking-wider uppercase">{title}</h2>
      <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
        {items.map((h) => (
          <li key={h.key} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            <span
              className={cn(
                "relative flex size-16 items-center justify-center rounded-full",
                !h.bare && "border-border border p-[3px]",
              )}
            >
              {h.bare ? (
                h.circle
              ) : (
                <span
                  className="flex size-full items-center justify-center rounded-full"
                  style={{ background: h.background }}
                >
                  {h.circle}
                </span>
              )}
              {h.count && h.count > 1 ? (
                <span
                  data-numeric
                  className="bg-foreground text-background ring-background absolute -right-0.5 -bottom-0.5 min-w-5 rounded-full px-1 text-center text-[0.65rem] leading-5 font-bold ring-2"
                >
                  {h.count}
                </span>
              ) : null}
            </span>
            <span className="w-full truncate text-center text-xs">{h.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Managed by …" line under the bio. */
export function Managers({ data }: { data: ProfileData }) {
  const { managers } = data.user;
  if (managers.length === 0) return null;
  return (
    <p className="text-muted text-sm">
      Manager{managers.length === 1 ? "" : "s"}:{" "}
      {managers.map((m, i) => (
        <span key={m.manager.id}>
          {i > 0 && ", "}
          <Link href={`/profile/${m.manager.id}`} className="text-foreground font-semibold">
            {m.manager.name}
          </Link>
        </span>
      ))}
    </p>
  );
}
