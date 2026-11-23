"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { medalFigure, serviceLabel, serviceTier, type ServiceTier, type ServiceTierKey } from "@/lib/service";

/**
 * Length-of-service medals: a struck metal medal on a striped ribbon, a laurel
 * wreath round the months or years. Deliberately unlike the holo hexagons
 * used for values and awards, so it reads as an honour rather than a sticker.
 * Each tier is a rarer metal; gold and up catch the light now and then, and
 * the top two glow. All motion is off with reduced motion (globals.css,
 * "Service medals").
 */

type Metal = {
  /** Rim: light, mid, dark. */
  rim: [string, string, string];
  /** Face behind the number: top, bottom. */
  face: [string, string];
  /** Wreath and number. */
  relief: [string, string];
  /** Ribbon: base, stripe. */
  ribbon: [string, string];
  /** Glow under the medal. */
  glow: string;
};

const METALS: Record<ServiceTierKey, Metal> = {
  steel: {
    rim: ["#f1f4f7", "#8d98a6", "#3f4752"],
    face: ["#6d7887", "#2f3742"],
    relief: ["#ffffff", "#cdd5df"],
    ribbon: ["#2f3742", "#9aa5b3"],
    glow: "#6d7887",
  },
  bronze: {
    rim: ["#ffd9b3", "#c47a3a", "#6e3812"],
    face: ["#b8692c", "#6b3410"],
    relief: ["#ffe1c2", "#d08a4e"],
    ribbon: ["#7a2e1c", "#e0a060"],
    glow: "#c47a3a",
  },
  copper: {
    rim: ["#ffd0b8", "#d0643a", "#6e2410"],
    face: ["#c2552c", "#6a1f0c"],
    relief: ["#ffe0d0", "#f0a07a"],
    ribbon: ["#0f5c5c", "#f0a07a"],
    glow: "#d0643a",
  },
  silver: {
    rim: ["#ffffff", "#c3c8d3", "#6c7384"],
    face: ["#a9afbd", "#5c6375"],
    relief: ["#ffffff", "#d3d7e0"],
    ribbon: ["#1f2e5c", "#e8ebf2"],
    glow: "#8a93a8",
  },
  rosegold: {
    rim: ["#ffe4e0", "#e2938a", "#8a4a47"],
    face: ["#d8847c", "#7e3c3c"],
    relief: ["#fff0ec", "#f6c3bb"],
    ribbon: ["#5b1d3a", "#f6c3bb"],
    glow: "#d4837a",
  },
  gold: {
    rim: ["#fff4c2", "#e2a91c", "#7c5302"],
    face: ["#d79b12", "#875900"],
    relief: ["#fff6cf", "#f3c94f"],
    ribbon: ["#9e1830", "#f5c542"],
    glow: "#e2a91c",
  },
  platinum: {
    rim: ["#ffffff", "#d9e2ee", "#7d8ba3"],
    face: ["#8fa3c2", "#3c4c6e"],
    relief: ["#ffffff", "#e2ebf7"],
    ribbon: ["#123c8c", "#ffffff"],
    glow: "#9fb4d6",
  },
  diamond: {
    rim: ["#ffffff", "#bfe8ff", "#4f8fcf"],
    face: ["#4cc3ff", "#1b2f8f"],
    relief: ["#ffffff", "#c8f0ff"],
    ribbon: ["#0b6b78", "#9ff3ff"],
    glow: "#4cc3ff",
  },
  legend: {
    rim: ["#fff2b8", "#d9a21b", "#6b4300"],
    face: ["#2e2250", "#0a0614"],
    relief: ["#fff3c4", "#f0b928"],
    ribbon: ["#4b1fb8", "#f5c542"],
    glow: "#8b5cf6",
  },
};

/** Laurel leaves round the face, open at the top: [cx, cy, rotation°]. */
const LEAVES: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  const R = 24.5;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      // From the lower side (θ=46°) round to the shoulder (θ=146°), leaving room for "YEARS" under the number.
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
  /** Width in px; the medal with its ribbon is 1.2× as tall. */
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
  // Below 32px only the medal itself is drawn: no ribbon, no wreath.
  const mini = size < 32;
  // Tiers only show their milestone; Legends show their real count.
  const served = tier.key === "legend" && !tierOverride ? Math.max(months, tier.months) : tier.months;
  const figure = medalFigure(served);
  // Too small for "MONTHS" under the number, so half a year reads "½".
  const shown = mini && served < 12 ? "½" : String(figure.value);
  const digits = shown.length;
  const id = (k: string) => `sm-${uid}-${k}`;
  const label = locked
    ? `${tier.name} service medal, ${serviceLabel(tier.months)}: not earned yet`
    : `${tier.name} service medal: ${serviceLabel(served)} of service`;

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
          "--glow": m.glow,
        } as React.CSSProperties
      }
    >
      <svg viewBox={mini ? "8 8 84 84" : "0 0 100 120"} width={size} height={mini ? size : size * 1.2} aria-hidden>
        <defs>
          <linearGradient id={id("rim")} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor={m.rim[0]} />
            <stop offset="0.45" stopColor={m.rim[1]} />
            <stop offset="0.7" stopColor={m.rim[2]} />
            <stop offset="1" stopColor={m.rim[1]} />
          </linearGradient>
          <radialGradient id={id("face")} cx="0.38" cy="0.3" r="0.85">
            <stop offset="0" stopColor={m.face[0]} />
            <stop offset="1" stopColor={m.face[1]} />
          </radialGradient>
          <linearGradient id={id("relief")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={m.relief[0]} />
            <stop offset="1" stopColor={m.relief[1]} />
          </linearGradient>
          <linearGradient id={id("ribbon")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={m.ribbon[0]} />
            <stop offset="0.36" stopColor={m.ribbon[0]} />
            <stop offset="0.36" stopColor={m.ribbon[1]} />
            <stop offset="0.5" stopColor={m.ribbon[1]} />
            <stop offset="0.5" stopColor={m.ribbon[0]} />
            <stop offset="0.64" stopColor={m.ribbon[0]} />
            <stop offset="0.64" stopColor={m.ribbon[1]} />
            <stop offset="0.78" stopColor={m.ribbon[1]} />
            <stop offset="0.78" stopColor={m.ribbon[0]} />
          </linearGradient>
          <linearGradient id={id("shine")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={id("disc")}>
            <circle cx="50" cy="50" r="40" />
          </clipPath>
        </defs>

        {!mini && (
          <g className="service-medal-ribbon">
            {/* Two tails hanging behind the medal, notched at the ends. */}
            <path d="M30 62 L50 70 L39 118 L32 109 L22 113 Z" fill={`url(#${id("ribbon")})`} />
            <path d="M70 62 L50 70 L61 118 L68 109 L78 113 Z" fill={`url(#${id("ribbon")})`} />
            <path d="M30 62 L50 70 L39 118 L32 109 L22 113 Z M70 62 L50 70 L61 118 L68 109 L78 113 Z" fill="#000" opacity="0.12" />
          </g>
        )}

        {/* Rim with a milled edge, then the face. */}
        <circle cx="50" cy="50" r="40" fill={`url(#${id("rim")})`} />
        <circle cx="50" cy="50" r="38.2" fill="none" stroke={m.rim[2]} strokeOpacity="0.45" strokeWidth="2.4" strokeDasharray="1.1 1.3" />
        <circle cx="50" cy="50" r="32.5" fill={m.rim[2]} opacity="0.55" />
        <circle cx="50" cy="50" r="31" fill={`url(#${id("face")})`} />
        <circle cx="50" cy="50" r="31" fill="none" stroke={m.relief[0]} strokeOpacity="0.5" strokeWidth="0.8" />

        {!mini && (
          <g fill={`url(#${id("relief")})`} className="service-medal-wreath">
            {LEAVES.map(([x, y, r], i) => (
              <ellipse key={i} cx={x} cy={y} rx="2" ry="4.6" transform={`rotate(${r} ${x} ${y})`} />
            ))}
          </g>
        )}

        {/* Stars over the number: one for Platinum, two for Diamond, three for Legend. */}
        {!mini && starsFor(tier.key).length > 0 && (
          <g fill={`url(#${id("relief")})`}>
            {starsFor(tier.key).map((x) => (
              <path key={x} d={star(x, 29.5, 3.4)} />
            ))}
          </g>
        )}

        {/* The number, struck in relief: a dark shadow under a light face. */}
        <g
          style={{ fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}
          fontWeight={900}
          textAnchor="middle"
        >
          <text
            x="50"
            y={mini ? 61 : 58.5}
            fontSize={mini ? (digits > 1 ? 34 : 40) : digits > 1 ? 24 : 29}
            letterSpacing={digits > 1 ? -1.5 : 0}
            fill={m.face[1]}
            opacity="0.7"
            transform="translate(0 1.4)"
          >
            {shown}
          </text>
          <text
            x="50"
            y={mini ? 61 : 58.5}
            fontSize={mini ? (digits > 1 ? 34 : 40) : digits > 1 ? 24 : 29}
            letterSpacing={digits > 1 ? -1.5 : 0}
            fill={`url(#${id("relief")})`}
          >
            {shown}
          </text>
          {!mini && (
            <text x="50" y="72" fontSize={figure.unit.length > 5 ? 5.4 : 6.4} letterSpacing={figure.unit.length > 5 ? 1 : 1.4} fill={m.relief[0]} opacity="0.9">
              {figure.unit}
            </text>
          )}
        </g>

        {/* A band of light that sweeps across now and then (gold and up). */}
        <g clipPath={`url(#${id("disc")})`}>
          <rect className="service-medal-shine" x="-40" y="0" width="26" height="100" fill={`url(#${id("shine")})`} transform="skewX(-18)" />
        </g>
      </svg>
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
