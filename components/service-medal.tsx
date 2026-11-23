"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { medalFigure, serviceLabel, serviceTier, type ServiceTier, type ServiceTierKey } from "@/lib/service";

/**
 * Years-of-service medals: a round coin with a polished metal rim and a
 * laurel wreath round the number of years. Built from the same layers as the
 * holo hexagons for values and awards (rim, face, holo foil, sheen), but
 * round and in rarer metals and stones each year, so it reads as an honour.
 * Gold (5 years) and up carry the shimmering holo foil, and the top two
 * glow. All motion is off with reduced motion (globals.css,
 * "Service medals").
 */

type Metal = {
  /** Rim: light, mid, dark. */
  rim: [string, string, string];
  /** Face behind the number: top, bottom. */
  face: [string, string];
  /** Wreath and number. */
  relief: [string, string];
  /** Glow under the medal. */
  glow: string;
};

const METALS: Record<ServiceTierKey, Metal> = {
  steel: {
    rim: ["#f1f4f7", "#8d98a6", "#3f4752"],
    face: ["#6d7887", "#2f3742"],
    relief: ["#ffffff", "#cdd5df"],
    glow: "#6d7887",
  },
  bronze: {
    rim: ["#ffd9b3", "#c47a3a", "#6e3812"],
    face: ["#b8692c", "#6b3410"],
    relief: ["#ffe1c2", "#d08a4e"],
    glow: "#c47a3a",
  },
  copper: {
    rim: ["#ffd0b8", "#d0643a", "#6e2410"],
    face: ["#c2552c", "#6a1f0c"],
    relief: ["#ffe0d0", "#f0a07a"],
    glow: "#d0643a",
  },
  silver: {
    rim: ["#ffffff", "#c3c8d3", "#6c7384"],
    face: ["#a9afbd", "#5c6375"],
    relief: ["#ffffff", "#d3d7e0"],
    glow: "#8a93a8",
  },
  rosegold: {
    rim: ["#ffe4e0", "#e2938a", "#8a4a47"],
    face: ["#d8847c", "#7e3c3c"],
    relief: ["#fff0ec", "#f6c3bb"],
    glow: "#d4837a",
  },
  emerald: {
    rim: ["#fff4c2", "#e2a91c", "#7c5302"],
    face: ["#1fb07a", "#04452c"],
    relief: ["#fff6cf", "#f3c94f"],
    glow: "#169a6a",
  },
  sapphire: {
    rim: ["#fff4c2", "#e2a91c", "#7c5302"],
    face: ["#3d6bf0", "#0c1d63"],
    relief: ["#fff6cf", "#f3c94f"],
    glow: "#2b4fc7",
  },
  ruby: {
    rim: ["#fff4c2", "#e2a91c", "#7c5302"],
    face: ["#e3304f", "#5c0718"],
    relief: ["#fff6cf", "#f3c94f"],
    glow: "#c4203f",
  },
  gold: {
    rim: ["#fff4c2", "#e2a91c", "#7c5302"],
    face: ["#c08a0c", "#5a3a00"],
    relief: ["#fff6cf", "#f3c94f"],
    glow: "#e2a91c",
  },
  platinum: {
    rim: ["#ffffff", "#d9e2ee", "#7d8ba3"],
    face: ["#8fa3c2", "#3c4c6e"],
    relief: ["#ffffff", "#e2ebf7"],
    glow: "#9fb4d6",
  },
  diamond: {
    rim: ["#ffffff", "#bfe8ff", "#4f8fcf"],
    face: ["#4cc3ff", "#1b2f8f"],
    relief: ["#ffffff", "#c8f0ff"],
    glow: "#4cc3ff",
  },
  legend: {
    rim: ["#fff2b8", "#d9a21b", "#6b4300"],
    face: ["#2e2250", "#0a0614"],
    relief: ["#fff3c4", "#f0b928"],
    glow: "#8b5cf6",
  },
};

/** Laurel leaves round the face, open at the top: [cx, cy, rotation°]. */
const LEAVES: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  const R = 26;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      // From the lower side (θ=46°) round to the shoulder (θ=146°), leaving room for "YEARS".
      const theta = ((46 + i * 20) * Math.PI) / 180;
      const nx = side * Math.sin(theta);
      const ny = Math.cos(theta);
      // Leaves point along the branch, upward, one tipped out and one in.
      const along = (side * Math.atan2(Math.cos(theta), Math.sin(theta)) * 180) / Math.PI;
      for (const [off, tilt] of [
        [2, 26],
        [-2, -26],
      ]) {
        const x = 50 + nx * (R + off);
        const y = 50 + ny * (R + off);
        out.push([round(x), round(y), round(along + side * tilt)]);
      }
    }
  }
  return out;
})();

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function ServiceMedal({
  months,
  size = 64,
  tier: tierOverride,
  locked = false,
  className,
}: {
  /** Whole months of service. */
  months: number;
  /** Diameter in px. */
  size?: number;
  /** Draw this tier instead of the one `months` earns (the ladder of medals). */
  tier?: ServiceTier;
  /** Not earned yet: greyed out. */
  locked?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tier = tierOverride ?? serviceTier(months);
  if (!tier) return null;
  const m = METALS[tier.key];
  // Small coins drop the wreath, stars and unit, and don't shimmer.
  const mini = size < 32;
  // Tiers only show their milestone; Legends show their real count.
  const served = tier.key === "legend" && !tierOverride ? Math.max(months, tier.months) : tier.months;
  const figure = medalFigure(served);
  const shown = String(figure.value);
  const digits = shown.length;
  const id = (k: string) => `sm-${uid}-${k}`;
  const label = locked
    ? `${tier.name} service medal, ${serviceLabel(tier.months)}: not earned yet`
    : `${tier.name} service medal: ${serviceLabel(served)} of service`;
  const numberY = mini ? 63 : 58;
  const numberSize = mini ? (digits > 1 ? 40 : 46) : digits > 1 ? 27 : 32;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("service-medal", className)}
      data-tier={tier.key}
      data-mini={mini || undefined}
      data-locked={locked || undefined}
      style={
        {
          "--s": `${size}px`,
          "--rim-hi": m.rim[0],
          "--rim": m.rim[1],
          "--rim-lo": m.rim[2],
          "--face-hi": m.face[0],
          "--face-lo": m.face[1],
          "--glow": m.glow,
        } as React.CSSProperties
      }
    >
      {/* Polished metal rim, the face, holo foil and a sheen: same layers as
          the value and award badges, in a circle. */}
      <span aria-hidden className="service-medal-rim" />
      <span aria-hidden className="service-medal-face">
        <span className="service-medal-foil" />
        <span className="service-medal-shine" />
      </span>
      <svg viewBox="0 0 100 100" aria-hidden className="service-medal-art">
        <defs>
          <linearGradient id={id("relief")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={m.relief[0]} />
            <stop offset="1" stopColor={m.relief[1]} />
          </linearGradient>
        </defs>
        {!mini && (
          <g fill={`url(#${id("relief")})`} opacity="0.95">
            {LEAVES.map(([x, y, r], i) => (
              <ellipse key={i} cx={x} cy={y} rx="2" ry="4.6" transform={`rotate(${r} ${x} ${y})`} />
            ))}
            {starsFor(tier.key).map((x) => (
              <path key={x} d={star(x, 28.5, 3.4)} />
            ))}
          </g>
        )}
        {/* The number, struck in relief: a dark shadow under a light face. */}
        <g style={{ fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }} fontWeight={900} textAnchor="middle">
          <text
            x="50"
            y={numberY}
            fontSize={numberSize}
            letterSpacing={digits > 1 ? -1.5 : 0}
            fill="#000"
            opacity="0.4"
            transform="translate(0 1.8)"
          >
            {shown}
          </text>
          <text x="50" y={numberY} fontSize={numberSize} letterSpacing={digits > 1 ? -1.5 : 0} fill={`url(#${id("relief")})`}>
            {shown}
          </text>
          {!mini && (
            <text x="50" y="71" fontSize="6.2" letterSpacing="1.6" fill={m.relief[0]} opacity="0.9">
              {figure.unit}
            </text>
          )}
        </g>
      </svg>
      {/* The sparkle the holo badges carry, from Gold (5 years) up. */}
      {size >= 60 && !locked && tier.months >= 60 && (
        <svg aria-hidden viewBox="0 0 24 24" className="service-medal-spark" fill="currentColor">
          <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
        </svg>
      )}
    </span>
  );
}

function starsFor(key: ServiceTierKey): number[] {
  if (key === "legend") return [41, 50, 59];
  if (key === "diamond") return [45.5, 54.5];
  if (key === "platinum") return [50];
  return [];
}

/** A five-pointed star centred on (cx, cy). */
function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${round(cx + rad * Math.cos(a))},${round(cy + rad * Math.sin(a))}`);
  }
  return `M${pts.join("L")}Z`;
}
