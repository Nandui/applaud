"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

const COLOURS = ["#7c5cff", "#c6f432", "#ff4f9a", "#22d3ee", "#ffb020", "#ffffff"];

/** Deterministic pseudo-random so server and client agree (no hydration drift). */
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * A one-shot confetti burst (Runna / Duolingo celebration screens), drawn with
 * framer-motion so we don't pull in a canvas library. Pieces fall from the top
 * with a little drift and spin; reduced-motion users get nothing.
 */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const reduce = useReducedMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: rand(i + 1) * 100,
        delay: rand(i + 101) * 0.6,
        duration: 1.8 + rand(i + 201) * 1.6,
        drift: (rand(i + 301) - 0.5) * 160,
        spin: (rand(i + 401) - 0.5) * 900,
        w: 6 + rand(i + 501) * 7,
        h: 8 + rand(i + 601) * 10,
        round: rand(i + 701) > 0.7,
        colour: COLOURS[i % COLOURS.length],
      })),
    [pieces],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.round ? b.w : b.h,
            borderRadius: b.round ? 9999 : 2,
            backgroundColor: b.colour,
          }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: b.drift, rotate: b.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: b.duration, delay: b.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
