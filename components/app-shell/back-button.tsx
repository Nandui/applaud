"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { appBarIconClass } from "./app-bar";

/** iOS-style back chevron: pops history, or falls back to a parent route. */
export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      className={appBarIconClass}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <ChevronLeft className="size-6.5" strokeWidth={2.25} />
    </button>
  );
}
