"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUp, Inbox, Loader2, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { answerQuestion, getQuestionAnswers, type QuestionAnswerView } from "@/lib/posts/actions";
import { ANSWER_MAX_LENGTH } from "@/lib/posts/kinds";
import type { FeedQuestion } from "@/lib/recognition/queries";
import { FramedAvatar } from "@/components/user-avatar";
import { formatNumber } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Under a question: a private answer box for everyone else, or the answers
 * button for the person who asked. Answers never appear in the feed.
 */
export function QuestionAnswers({
  questionId,
  question,
  isAsker,
  askerName,
}: {
  questionId: string;
  question: FeedQuestion;
  isAsker: boolean;
  askerName: string;
}) {
  return isAsker ? (
    <AskerAnswers questionId={questionId} count={question.answerCount} />
  ) : (
    <AnswerBox questionId={questionId} initial={question.myAnswer} askerName={askerName} />
  );
}

function AnswerBox({
  questionId,
  initial,
  askerName,
}: {
  questionId: string;
  initial: string | null;
  askerName: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [editing, setEditing] = useState(initial === null);
  const [draft, setDraft] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const first = askerName.split(" ")[0] ?? askerName;

  function submit() {
    const body = draft.trim();
    if (!body || pending) return;
    start(async () => {
      const res = await answerQuestion(questionId, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(body);
      setEditing(false);
      toast.success(saved ? "Answer updated" : `Sent privately to ${first}`);
    });
  }

  if (!editing && saved) {
    return (
      <div className="bg-surface-2 mt-3 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-muted flex flex-1 items-center gap-1.5 text-[0.78rem] font-semibold">
            <Lock className="size-3.5" /> Your answer · only {first} sees it
          </p>
          <button
            type="button"
            onClick={() => {
              setDraft(saved);
              setEditing(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="text-primary flex items-center gap-1 text-[0.82rem] font-semibold"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
        </div>
        <p className="mt-1 text-[0.95rem] leading-snug break-words whitespace-pre-line">{saved}</p>
      </div>
    );
  }

  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="border-border focus-within:border-primary flex items-end gap-2 rounded-2xl border py-1.5 pr-1.5 pl-4 transition-colors">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={ANSWER_MAX_LENGTH}
          placeholder="Write your answer…"
          aria-label={`Your private answer to ${askerName}`}
          className="placeholder:text-muted max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[0.95rem] leading-snug outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || pending}
          aria-label="Send answer"
          className="bg-primary text-primary-fg flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-35"
        >
          {pending ? <Loader2 className="size-4.5 animate-spin" /> : <ArrowUp className="size-5" strokeWidth={2.5} />}
        </button>
      </div>
      <p className="text-muted mt-1.5 flex items-center gap-1.5 text-[0.8rem]">
        <Lock className="size-3.5" /> Private. Only {first} will see your answer.
        {saved && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-foreground ml-auto font-semibold"
          >
            Cancel
          </button>
        )}
      </p>
    </form>
  );
}

function AskerAnswers({ questionId, count }: { questionId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<QuestionAnswerView[] | null>(null);
  const [loading, start] = useTransition();

  function show() {
    setOpen(true);
    start(async () => {
      const res = await getQuestionAnswers(questionId);
      if (res.ok) setAnswers(res.answers);
      else toast.error(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="bg-surface-2 mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.99]"
      >
        <span className="bg-primary text-primary-fg flex size-9 shrink-0 items-center justify-center rounded-full">
          <Inbox className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[0.95rem] font-bold">
            {count === 0 ? (
              "No answers yet"
            ) : (
              <>
                <span data-numeric>{formatNumber(count)}</span> {count === 1 ? "answer" : "answers"}
              </>
            )}
          </span>
          <span className="text-muted mt-0.5 flex items-center gap-1 text-[0.8rem]">
            <Lock className="size-3" /> Only you can read them
          </span>
        </span>
        {count > 0 && <span className="text-primary text-sm font-semibold">View</span>}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
          <SheetHeader className="border-b pt-1 pb-3">
            <SheetTitle className="text-center text-base">Answers</SheetTitle>
            <SheetDescription className="text-muted flex items-center justify-center gap-1 text-center text-xs">
              <Lock className="size-3" /> Private. Only you can read these.
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[70svh] overflow-y-auto">
            {answers === null || (loading && answers.length === 0) ? (
              <div className="flex justify-center py-10">
                <Loader2 className="text-muted size-5 animate-spin" />
              </div>
            ) : answers.length === 0 ? (
              <p className="text-muted px-6 py-10 text-center text-sm">
                No answers yet. They&apos;ll show up here as people reply.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {answers.map((a) => (
                  <li key={a.id} className="flex gap-3 px-4 py-3.5">
                    <Link href={`/profile/${a.user.id}`} className="shrink-0">
                      <FramedAvatar
                        name={a.user.name}
                        avatarUrl={a.user.avatarUrl}
                        frame={a.user.frame}
                        className="size-10 text-sm"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.9rem] leading-tight">
                        <Link href={`/profile/${a.user.id}`} className="font-semibold">
                          {a.user.name}
                        </Link>
                        <time title={a.createdAtFull} className="text-muted ml-1.5 text-[0.8rem]">
                          {a.createdAtLabel}
                          {a.edited ? " · edited" : ""}
                        </time>
                      </p>
                      {a.user.jobTitle && (
                        <p className="text-muted truncate text-[0.78rem]">{a.user.jobTitle}</p>
                      )}
                      <p className="mt-1 text-[0.95rem] leading-snug break-words whitespace-pre-line">{a.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
