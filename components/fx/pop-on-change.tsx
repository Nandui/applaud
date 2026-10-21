"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Gives its children a small bounce whenever `value` changes, but not when
 * they first show: used when someone equips a frame, banner or theme.
 * The `.pop` animation lives in globals.css and is off for reduced motion.
 */
export function PopOnChange({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || last.current === value) return;
    last.current = value;
    // Restart the animation if it's already running.
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }, [value]);

  return (
    <span
      ref={ref}
      className={cn("inline-flex", className)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove("pop");
      }}
    >
      {children}
    </span>
  );
}
