import Link from "next/link";
import { ChevronRight, Lightbulb } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import type { SuggestionKind } from "@/lib/suggestions";

const COPY: Record<SuggestionKind, string> = {
  reward: "Missing a reward you'd love?",
  shop: "Want a frame, banner or theme we don't have?",
};

/** The way into Ideas at the foot of Rewards and the Profile shop. */
export async function IdeasEntry({ kind }: { kind: SuggestionKind }) {
  const open = await prisma.suggestion.count({ where: { kind, status: { in: ["new", "planned"] } } });
  return (
    <Link
      href={`/rewards/ideas?k=${kind}`}
      className="bg-surface hover:bg-surface-2 mt-8 flex items-center gap-3 rounded-2xl p-4 transition-colors"
    >
      <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
        <Lightbulb className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{COPY[kind]}</span>
        <span className="text-muted block text-sm">
          {open > 0
            ? `Suggest it, or upvote ${formatNumber(open)} idea${open === 1 ? "" : "s"} from the team.`
            : "Suggest it. The team looks at every idea."}
        </span>
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </Link>
  );
}
