"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronRight, ChevronUp, Lightbulb, MessageSquare, PartyPopper, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { relativeTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createSuggestion, deleteSuggestion, toggleSuggestionVote } from "@/lib/suggestion-actions";
import {
  DETAILS_MAX,
  KIND_TEXT,
  STATUS_LABELS,
  STATUS_TONE,
  TITLE_MAX,
  similarIdeas,
  type SuggestionKind,
  type SuggestionStatus,
} from "@/lib/suggestions";

export type IdeaData = {
  id: string;
  title: string;
  details: string | null;
  status: SuggestionStatus;
  adminNote: string | null;
  votes: number;
  voted: boolean;
  createdAt: string;
  mine: boolean;
  author: { id: string; name: string; avatarUrl: string | null };
  /** What it became, once it's available and still on show. */
  item: { name: string; href: string } | null;
};

export function IdeaStatusBadge({
  status,
  label,
  className,
}: {
  status: SuggestionStatus;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        STATUS_TONE[status],
        className,
      )}
    >
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}

/**
 * The Ideas list for one kind: a "Suggest" button, open ideas by upvotes,
 * then what's been added and what isn't planned.
 */
export function IdeasBoard({
  kind,
  ideas: initial,
  startSuggesting = false,
}: {
  kind: SuggestionKind;
  ideas: IdeaData[];
  /** Opened from a "Suggest an idea" button: show the form straight away. */
  startSuggesting?: boolean;
}) {
  // Votes are applied here straight away and kept in sync with the server's count.
  const [overrides, setOverrides] = useState<Record<string, { voted: boolean; votes: number }>>({});
  const ideas = useMemo(
    () => initial.map((i) => (overrides[i.id] ? { ...i, ...overrides[i.id] } : i)),
    [initial, overrides],
  );
  const [open, setOpen] = useState(startSuggesting);
  const text = KIND_TEXT[kind];

  const openIdeas = ideas.filter((i) => i.status === "new" || i.status === "planned");
  const added = ideas.filter((i) => i.status === "added");
  const declined = ideas.filter((i) => i.status === "declined");

  function onVoted(id: string, voted: boolean, votes: number) {
    setOverrides((o) => ({ ...o, [id]: { voted, votes } }));
  }

  return (
    <div className="pb-8">
      <div className="bg-surface flex items-start gap-3 rounded-2xl p-4">
        <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <Lightbulb className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{text.prompt}</p>
          <p className="text-muted mt-0.5 text-sm">
            Suggest it, or upvote ideas you like. The most wanted go to the top for the team to look at.
          </p>
          <Button className="mt-3" onClick={() => setOpen(true)}>
            <Plus /> Suggest a {text.one}
          </Button>
        </div>
      </div>

      {openIdeas.length === 0 && added.length === 0 && declined.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-1 py-14 text-center">
          <p className="text-foreground font-bold">No ideas yet</p>
          <p className="text-sm">Be the first to suggest one.</p>
        </div>
      ) : null}

      {openIdeas.length > 0 ? (
        <Section title="Most wanted">
          {openIdeas.map((idea) => (
            <IdeaRow key={idea.id} idea={idea} onVoted={onVoted} />
          ))}
        </Section>
      ) : null}

      {added.length > 0 ? (
        <Section title="Now available">
          {added.map((idea) => (
            <IdeaRow key={idea.id} idea={idea} onVoted={onVoted} />
          ))}
        </Section>
      ) : null}

      {declined.length > 0 ? (
        <details className="group mt-7">
          <summary className="text-muted cursor-pointer list-none text-sm font-semibold select-none">
            <span className="group-open:hidden">Show {declined.length} not planned</span>
            <span className="hidden group-open:inline">Hide not planned</span>
          </summary>
          <ul className="divide-border mt-2 divide-y">
            {declined.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} onVoted={onVoted} />
            ))}
          </ul>
        </details>
      ) : null}

      <SuggestDialog kind={kind} open={open} onOpenChange={setOpen} ideas={openIdeas.concat(added)} onVoted={onVoted} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1 text-[0.95rem] font-bold">{title}</h2>
      <ul className="divide-border divide-y">{children}</ul>
    </section>
  );
}

function VoteButton({
  idea,
  onVoted,
  compact = false,
}: {
  idea: IdeaData;
  onVoted: (id: string, voted: boolean, votes: number) => void;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const closed = idea.status === "added" || idea.status === "declined";

  function vote() {
    const before = { voted: idea.voted, votes: idea.votes };
    onVoted(idea.id, !idea.voted, idea.votes + (idea.voted ? -1 : 1));
    const fd = new FormData();
    fd.set("id", idea.id);
    start(async () => {
      const res = await toggleSuggestionVote(fd);
      if (res.ok) onVoted(idea.id, res.voted, res.count);
      else {
        onVoted(idea.id, before.voted, before.votes);
        toast.error(res.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={vote}
      disabled={pending || closed}
      aria-pressed={idea.voted}
      aria-label={`${idea.voted ? "Remove your upvote" : "Upvote"}: ${idea.title}. ${idea.votes} votes`}
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-xl border font-semibold transition-[transform,colors] active:scale-95 disabled:active:scale-100",
        compact ? "h-11 w-11 text-xs" : "h-14 w-12 text-sm",
        idea.voted ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground",
        closed && "opacity-60",
      )}
    >
      <ChevronUp className={compact ? "size-4" : "size-5"} strokeWidth={2.5} aria-hidden />
      <span data-numeric className="-mt-0.5 leading-none">
        {formatNumber(idea.votes)}
      </span>
    </button>
  );
}

function IdeaRow({
  idea,
  onVoted,
}: {
  idea: IdeaData;
  onVoted: (id: string, voted: boolean, votes: number) => void;
}) {
  const router = useRouter();
  const [removing, start] = useTransition();

  function remove() {
    if (!window.confirm("Remove your idea? Its upvotes go with it.")) return;
    const fd = new FormData();
    fd.set("id", idea.id);
    start(async () => {
      const res = await deleteSuggestion(fd);
      if (res.ok) {
        toast.success(res.message ?? "Removed");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <li className="flex gap-3 py-3.5" data-idea={idea.id}>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 font-semibold break-words">{idea.title}</p>
          {idea.status !== "new" ? <IdeaStatusBadge status={idea.status} className="mt-0.5" /> : null}
        </div>
        {idea.details ? (
          <p className="text-muted mt-0.5 text-sm break-words whitespace-pre-line">{idea.details}</p>
        ) : null}
        <div className="text-muted mt-1.5 flex items-center gap-1.5 text-xs">
          <UserAvatar name={idea.author.name} avatarUrl={idea.author.avatarUrl} className="size-5" />
          <span className="truncate" suppressHydrationWarning>
            {idea.mine ? "You" : idea.author.name} · {relativeTime(idea.createdAt)}
          </span>
          {idea.mine && idea.status === "new" ? (
            <button
              type="button"
              onClick={remove}
              disabled={removing}
              className="hover:text-foreground ml-1 font-semibold underline-offset-2 hover:underline"
            >
              Remove
            </button>
          ) : null}
        </div>
        {idea.status === "added" && idea.item ? (
          <Link
            href={idea.item.href}
            className="bg-success/10 text-success hover:bg-success/15 mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
          >
            <PartyPopper className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {idea.mine ? "Your idea is in: " : "Now in the store: "}
              {idea.item.name}
            </span>
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          </Link>
        ) : null}
        {idea.adminNote ? (
          <div className="bg-surface mt-2 flex gap-2 rounded-xl px-3 py-2 text-sm">
            <MessageSquare className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="min-w-0 break-words whitespace-pre-line">
              <span className="font-semibold">From the team: </span>
              {idea.adminNote}
            </p>
          </div>
        ) : null}
      </div>
      <VoteButton idea={idea} onVoted={onVoted} />
    </li>
  );
}

/** The "Suggest" sheet. Shows matching ideas while you type so you can upvote instead. */
function SuggestDialog({
  kind,
  open,
  onOpenChange,
  ideas,
  onVoted,
}: {
  kind: SuggestionKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideas: IdeaData[];
  onVoted: (id: string, voted: boolean, votes: number) => void;
}) {
  const router = useRouter();
  const text = KIND_TEXT[kind];
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  const similar = useMemo(() => similarIdeas(title, ideas), [title, ideas]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("title", title);
    fd.set("details", details);
    start(async () => {
      const res = await createSuggestion(fd);
      if (res.ok) {
        toast.success(res.message ?? "Thanks!");
        setTitle("");
        setDetails("");
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Suggest a {text.one}</DialogTitle>
            <DialogDescription>{text.prompt}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label htmlFor="idea-title" className="text-sm font-semibold">
              Your idea
            </label>
            <Input
              id="idea-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder={text.placeholder}
              autoComplete="off"
              required
            />
          </div>
          {similar.length > 0 ? (
            <div className="bg-surface rounded-xl p-3">
              <p className="text-sm font-semibold">Already suggested? Upvote it instead</p>
              <ul className="mt-2 grid gap-2">
                {similar.map((idea) => (
                  <li key={idea.id} className="flex items-center gap-2.5">
                    <VoteButton idea={idea} onVoted={onVoted} compact />
                    <span className="min-w-0 flex-1 text-sm break-words">{idea.title}</span>
                    {idea.status !== "new" ? <IdeaStatusBadge status={idea.status} /> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <label htmlFor="idea-details" className="text-sm font-semibold">
              Details <span className="text-muted font-normal">(optional)</span>
            </label>
            <Textarea
              id="idea-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={DETAILS_MAX}
              rows={3}
              placeholder={kind === "shop" ? "Colours, a picture you have in mind…" : "Where from, how much it might cost…"}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || title.trim().length < 3}>
              {pending ? "Sending…" : "Suggest it"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
