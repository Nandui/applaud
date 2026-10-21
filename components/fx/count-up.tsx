"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format";

/**
 * A number that eases up from zero when it first shows (profile counts).
 * Screen readers get the real number straight away; people who ask for less
 * motion see it land at once.
 */
export function CountUp({ value, duration = 800 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const length = reduce || value <= 0 ? 0 : duration;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = length === 0 ? 1 : Math.min(1, (now - start) / length);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <>
      <span className="sr-only">{formatNumber(value)}</span>
      <span aria-hidden>{formatNumber(shown)}</span>
    </>
  );
}
