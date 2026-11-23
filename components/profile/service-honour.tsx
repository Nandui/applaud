import { format } from "date-fns";
import { ServiceMedal } from "@/components/service-medal";
import {
  SERVICE_TIERS,
  anniversaryOf,
  nextServiceTier,
  serviceLabel,
  serviceTier,
} from "@/lib/service";
import type { ProfileData } from "@/lib/profile";

/**
 * Length of service on a profile: a plaque with their medal under the name
 * (from one year on), and in the Showcase the whole ladder of medals with
 * the ones still to come greyed out and when the next one arrives.
 */

/** The plaque under the name. Nothing before someone's first year. */
export function ServicePlaque({ service }: { service: NonNullable<ProfileData["service"]> }) {
  const tier = serviceTier(service.months);
  if (!tier) return null;
  const accent = tier.accent;
  return (
    <div
      className="mt-2 inline-flex max-w-full items-center gap-3 rounded-2xl border py-1.5 pr-4 pl-2"
      style={{
        background: `linear-gradient(100deg, color-mix(in srgb, ${accent} 22%, var(--background)) 0%, color-mix(in srgb, ${accent} 6%, var(--background)) 100%)`,
        borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
      }}
    >
      <ServiceMedal months={service.months} size={54} />
      <div className="min-w-0 leading-tight">
        <p
          className="text-[0.68rem] font-extrabold tracking-[0.14em] uppercase"
          style={{ color: `color-mix(in srgb, ${accent} 75%, var(--foreground))` }}
        >
          {tier.name} · Service medal
        </p>
        <p className="text-[1.05rem] font-extrabold tracking-tight">{serviceLabel(service.months)} with the team</p>
        <p className="text-muted text-xs">Since {format(service.since, "MMMM yyyy")}</p>
      </div>
    </div>
  );
}

/** Every medal, earned or not, and how long until the next. */
export function ServiceLadder({
  service,
  firstName,
  isMe,
}: {
  service: NonNullable<ProfileData["service"]>;
  firstName: string;
  isMe: boolean;
}) {
  const next = nextServiceTier(service.months);
  const current = serviceTier(service.months);
  const nextOn = next ? anniversaryOf(service.since, next.months) : null;
  // How far from the last medal (or the start date) to the next one.
  const from = current ? anniversaryOf(service.since, current.months) : service.since;
  const progress =
    nextOn && nextOn > from
      ? Math.min(1, Math.max(0, (service.asOf.getTime() - from.getTime()) / (nextOn.getTime() - from.getTime())))
      : 1;
  const accent = (next ?? SERVICE_TIERS[SERVICE_TIERS.length - 1]).accent;

  return (
    <div>
      <ol className="grid grid-cols-6 gap-x-1 gap-y-3 sm:grid-cols-12">
        {SERVICE_TIERS.map((t) => {
          const earned = service.months >= t.months;
          return (
            <li key={t.key} className="flex flex-col items-center gap-1 text-center">
              <ServiceMedal
                months={t.key === "legend" && earned ? service.months : t.months}
                tier={t.key === "legend" && earned ? undefined : t}
                locked={!earned}
                size={46}
              />
              <span className={earned ? "text-xs font-bold" : "text-muted text-xs"}>
                {ladderLabel(t.months)}
              </span>
            </li>
          );
        })}
      </ol>
      {next && nextOn ? (
        <div className="mt-4">
          <div className="bg-surface-2 h-1.5 overflow-hidden rounded-full">
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: accent }} />
          </div>
          <p className="text-muted mt-2 text-sm">
            {current ? "Next" : isMe ? "Your first medal" : `${firstName}'s first medal`}:{" "}
            <span className="text-foreground font-semibold">{next.name}</span> at {serviceLabel(next.months)}, on{" "}
            {format(nextOn, "d MMMM yyyy")}
          </p>
        </div>
      ) : (
        <p className="text-muted mt-3 text-sm">
          {isMe ? "You've" : `${firstName} has`} earned every service medal. A true legend.
        </p>
      )}
    </div>
  );
}

/** "6 mo", "1 yr", "5 yrs", "20+ yrs" under each medal of the ladder. */
function ladderLabel(months: number): string {
  if (months < 12) return `${months} mo`;
  const years = months / 12;
  return years >= 20 ? "20+ yrs" : `${years} ${years === 1 ? "yr" : "yrs"}`;
}
