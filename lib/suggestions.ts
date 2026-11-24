/**
 * Staff ideas for future rewards and profile shop items. Shared by the staff
 * Ideas page, Admin > Suggestions and the server actions (no server imports).
 */

export const SUGGESTION_KINDS = ["reward", "shop"] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const SUGGESTION_STATUSES = ["new", "planned", "added", "declined"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const isSuggestionKind = (v: unknown): v is SuggestionKind =>
  typeof v === "string" && (SUGGESTION_KINDS as readonly string[]).includes(v);
export const isSuggestionStatus = (v: unknown): v is SuggestionStatus =>
  typeof v === "string" && (SUGGESTION_STATUSES as readonly string[]).includes(v);

export const KIND_TEXT: Record<SuggestionKind, { tab: string; one: string; prompt: string; placeholder: string }> = {
  reward: {
    tab: "Rewards",
    one: "reward",
    prompt: "What reward would you like to work towards?",
    placeholder: "e.g. Cinema tickets for two",
  },
  shop: {
    tab: "Profile shop",
    one: "profile item",
    prompt: "What frame, banner or theme would you like to wear?",
    placeholder: "e.g. A Cork GAA banner",
  },
};

/** What staff see on an idea. "New" ideas show no status at all. */
export const STATUS_LABELS: Record<SuggestionStatus, string> = {
  new: "New",
  planned: "Planned",
  added: "Added",
  declined: "Not planned",
};

export const STATUS_TONE: Record<SuggestionStatus, string> = {
  new: "bg-surface-2 text-muted",
  planned: "bg-primary/15 text-primary",
  added: "bg-success/15 text-success",
  declined: "bg-danger/10 text-danger",
};

export const TITLE_MAX = 80;
export const DETAILS_MAX = 280;
export const NOTE_MAX = 280;
/** Ideas one person can post in 24 hours. */
export const DAILY_LIMIT = 5;

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "some", "more", "free", "please", "would", "like",
  "could", "should", "have", "about", "your", "their", "them", "into", "also", "just", "very", "a", "an",
]);

/** The words that make an idea what it is: lower-cased, no punctuation or filler, crude plural folding. */
export function ideaWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOP.has(w))
        .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)),
    ),
  ];
}

/**
 * Ideas already posted that look like what someone is typing, best match
 * first, so they upvote instead of posting the same thing twice.
 */
export function similarIdeas<T extends { title: string }>(draft: string, ideas: T[], limit = 3): T[] {
  const words = ideaWords(draft);
  if (words.length === 0) return [];
  const scored = ideas
    .map((idea) => {
      const theirs = new Set(ideaWords(idea.title));
      const shared = words.filter((w) => theirs.has(w) || [...theirs].some((t) => t.startsWith(w) || w.startsWith(t))).length;
      return { idea, score: shared / Math.max(words.length, 1) };
    })
    .filter((s) => s.score > 0 && (words.length < 3 ? s.score >= 0.5 : s.score >= 0.34));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.idea);
}
