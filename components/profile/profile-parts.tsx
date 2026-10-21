import Link from "next/link";
import { Trophy } from "lucide-react";
import { ValueSeal } from "@/components/value-seal";
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
};

/**
 * Story-highlight circles under the bio (Instagram): awards won, the values
 * this person has been recognised for (with counts), and milestones.
 */
export function Highlights({ data }: { data: ProfileData }) {
  const items: Highlight[] = [
    ...data.awards.map((a) => ({
      key: `award-${a.id}`,
      label: a.name,
      circle: <Trophy className="size-6 text-white" />,
      background: "linear-gradient(135deg, #fbbf24, #d97706)",
    })),
    ...data.valueTags.map((t) => ({
      key: `value-${t.value.id}`,
      label: t.value.name,
      circle: <ValueSeal value={t.value} size="sm" ribbon={false} className="size-full [&>span]:size-full [&>span]:ring-0" />,
      background: "transparent",
      count: t.count,
    })),
    ...data.celebrations.map((c) => ({
      key: `celebration-${c.id}`,
      label: CELEBRATION_LABELS[c.type] ?? c.type,
      circle: <span className="text-2xl leading-none">{CELEBRATION_EMOJI[c.type] ?? "🎉"}</span>,
      background: "var(--surface-2)",
    })),
  ];
  if (items.length === 0) return null;

  return (
    <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4" aria-label="Highlights">
      {items.map((h) => (
        <li key={h.key} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
          <span className="border-border relative flex size-16 items-center justify-center rounded-full border p-[3px]">
            <span
              className="flex size-full items-center justify-center rounded-full"
              style={{ background: h.background }}
            >
              {h.circle}
            </span>
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
