import Link from "next/link";
import { ChevronRight, Lightbulb, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import type { SuggestionKind } from "@/lib/suggestions";

const COPY: Record<SuggestionKind, { title: string; foot: string }> = {
  reward: { title: "What reward should we add next?", foot: "Didn't find the reward you want?" },
  shop: { title: "What should we add to the shop?", foot: "Want a frame, banner or theme we don't have?" },
};

/** Ideas staff can still upvote (new or approved). */
async function openIdeas(kind?: SuggestionKind) {
  return prisma.suggestion.count({ where: { ...(kind ? { kind } : {}), status: { in: ["new", "planned"] } } });
}

export const ideasHref = (kind: SuggestionKind, suggest = false) =>
  `/rewards/ideas?k=${kind}${suggest ? "&suggest=1" : ""}`;

/**
 * The way into Ideas on Rewards and the Profile shop. "hero" sits near the
 * top of the page, a violet card with a Suggest button that opens the form
 * straight away; "foot" is the quieter reminder at the end of the list.
 */
export async function IdeasEntry({ kind, variant = "hero" }: { kind: SuggestionKind; variant?: "hero" | "foot" }) {
  const open = await openIdeas(kind);

  if (variant === "foot") {
    return (
      <Link
        href={ideasHref(kind, true)}
        className="bg-surface hover:bg-surface-2 mt-8 flex items-center gap-3 rounded-2xl p-4 transition-colors"
      >
        <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <Lightbulb className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{COPY[kind].foot}</span>
          <span className="text-primary block text-sm font-semibold">Suggest it</span>
        </span>
        <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
      </Link>
    );
  }

  return (
    <section
      data-ideas-entry={kind}
      className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#6a4dff] to-[#9b5cff] p-4 text-white shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Lightbulb className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[1.05rem] leading-snug font-bold">{COPY[kind].title}</p>
          <p className="mt-0.5 text-sm text-white/85">
            Suggest it. If we add it, everyone hears it was your idea.
          </p>
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <Link
          href={ideasHref(kind, true)}
          className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold whitespace-nowrap text-[#4b2fd6] transition-transform active:scale-95"
        >
          <Plus className="size-4" strokeWidth={2.75} aria-hidden /> Suggest an idea
        </Link>
        <Link
          href={ideasHref(kind)}
          className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-semibold whitespace-nowrap transition-colors hover:bg-white/25"
        >
          See ideas
          {open > 0 ? (
            <span className="rounded-full bg-white/25 px-1.5 text-xs leading-5 font-bold" data-numeric>
              {formatNumber(open)}
            </span>
          ) : null}
        </Link>
      </div>
    </section>
  );
}

/** A row on Home, alongside the other quick links under the composer. */
export async function IdeasHomeRow() {
  const open = await openIdeas();
  return (
    <Link
      href={ideasHref("reward")}
      className="border-border active:bg-surface-2 -mx-4 flex items-center gap-3 border-b px-4 py-2.5 transition-colors md:mx-0"
    >
      <span className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
        <Lightbulb className="size-5" strokeWidth={2.2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[0.95rem] font-semibold">Got an idea for a reward or the shop?</span>
        <span className="text-muted block truncate text-[0.82rem]">
          {open > 0 ? `Suggest it, or upvote ${formatNumber(open)} from the team` : "Suggest it, the team looks at every one"}
        </span>
      </span>
      <ChevronRight className="text-muted size-4.5 shrink-0" />
    </Link>
  );
}
