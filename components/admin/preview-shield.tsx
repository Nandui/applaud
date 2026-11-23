"use client";

import { useEffect } from "react";

/**
 * Makes the admin's preview of a staff page look-only: every tap and key
 * press that would open a sheet, claim or leave the page is swallowed, except
 * links that stay inside the preview (category chips). With `focus` set, that
 * offering is outlined and scrolled into view.
 */
export function PreviewShield({ focus }: { focus: string | null }) {
  useEffect(() => {
    const stop = (e: Event) => {
      // Tab and arrow keys still move around; only "press" keys are blocked.
      if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
      const el = e.target instanceof Element ? e.target : null;
      const link = el?.closest("a");
      if (link?.getAttribute("href")?.startsWith("/admin-preview/")) return;
      if (el?.closest("button, a, [role=button], input, select, textarea, label")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const types = ["click", "pointerdown", "keydown", "submit"] as const;
    for (const t of types) document.addEventListener(t, stop, true);
    return () => {
      for (const t of types) document.removeEventListener(t, stop, true);
    };
  }, []);

  useEffect(() => {
    if (!focus) return;
    const els = [...document.querySelectorAll<HTMLElement>(`[data-reward-id="${CSS.escape(focus)}"]`)];
    for (const el of els) {
      el.style.outline = "3px solid var(--color-primary, #7c3aed)";
      el.style.outlineOffset = "3px";
      el.style.borderRadius = "14px";
    }
    els[0]?.scrollIntoView({ block: "center", inline: "center" });
  }, [focus]);

  return null;
}
