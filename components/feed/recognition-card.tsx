"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SmilePlus, Sparkles, Lock, Send } from "lucide-react";
import { toggleReaction, addComment } from "@/lib/recognition/actions";
import { REACTION_EMOJIS } from "@/lib/config";
import type { FeedCard } from "@/lib/recognition/queries";
import { UserAvatar } from "@/components/user-avatar";
import { ValueChip } from "@/components/value-chip";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pts } from "@/lib/format";
import { cn } from "@/lib/utils";

function RecipientNames({
  recipients,
}: {
  recipients: FeedCard["recipients"];
}) {
  return (
    <>
      {recipients.map((r, i) => (
        <Fragment key={r.id}>
          {i > 0 && (
            <span className="text-muted font-normal">
              {i === recipients.length - 1 ? " and " : ", "}
            </span>
          )}
          <Link
            href={`/profile/${r.id}`}
            className="hover:text-primary font-semibold"
          >
            {r.name}
          </Link>
        </Fragment>
      ))}
    </>
  );
}

export function RecognitionCard({
  card,
  index = 0,
}: {
  card: FeedCard;
  index?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [commentPending, startComment] = useTransition();

  function react(emoji: string) {
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("emoji", emoji);
    startTransition(() => {
      void toggleReaction(fd);
    });
  }

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const value = body.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("recognitionId", card.id);
    fd.set("body", value);
    startComment(async () => {
      const res = await addComment(fd);
      if (res.ok) setBody("");
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
    >
      <Card className={cn(card.system && "border-accent/40 bg-accent/[0.03]")}>
        <CardContent className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <UserAvatar
              name={card.sender.name}
              avatarUrl={card.sender.avatarUrl}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">
                {card.system ? (
                  <span className="text-accent inline-flex items-center gap-1 font-semibold">
                    <Sparkles className="size-3.5" /> {card.sender.name}
                  </span>
                ) : (
                  <Link
                    href={`/profile/${card.sender.id}`}
                    className="hover:text-primary font-semibold"
                  >
                    {card.sender.name}
                  </Link>
                )}{" "}
                <span className="text-muted font-normal">recognised</span>{" "}
                <RecipientNames recipients={card.recipients} />
              </p>
              <p className="text-muted mt-0.5 flex items-center gap-1.5 text-xs">
                <time title={card.createdAtFull}>{card.createdAtLabel}</time>
                {card.visibility === "private" && (
                  <>
                    <span>·</span>
                    <Lock className="size-3" /> Private
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {card.value && <ValueChip value={card.value} />}
              {card.pointsEach > 0 && (
                <span
                  data-numeric
                  className="text-success bg-success/10 rounded-full px-2 py-0.5 text-xs font-semibold"
                >
                  +{pts(card.pointsEach)}
                </span>
              )}
            </div>
          </div>

          {/* Message */}
          <p className="text-foreground text-[0.95rem] leading-relaxed whitespace-pre-line">
            {card.message}
          </p>

          {/* Reactions */}
          <div className="flex flex-wrap items-center gap-1.5">
            {card.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => react(r.emoji)}
                disabled={pending}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                  r.reacted
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                <span>{r.emoji}</span>
                <span data-numeric className="font-medium">
                  {r.count}
                </span>
              </button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="text-muted hover:bg-secondary hover:text-foreground flex size-7 items-center justify-center rounded-full border border-dashed transition-colors"
                  aria-label="Add reaction"
                >
                  <SmilePlus className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1.5" align="start">
                <div className="flex gap-1">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => react(emoji)}
                      className="hover:bg-secondary rounded-md p-1.5 text-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Comments */}
          {card.comments.length > 0 && (
            <div className="border-border space-y-3 border-t pt-3">
              {card.comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <UserAvatar
                    name={c.user.name}
                    avatarUrl={c.user.avatarUrl}
                    className="size-7"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <Link
                        href={`/profile/${c.user.id}`}
                        className="hover:text-primary font-medium"
                      >
                        {c.user.name}
                      </Link>{" "}
                      <span className="text-muted text-xs">
                        {c.createdAtLabel}
                      </span>
                    </p>
                    <p className="text-foreground/90 text-sm">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          <form
            onSubmit={submitComment}
            className="flex items-center gap-2 pt-1"
          >
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment…"
              maxLength={500}
              className="h-9"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={commentPending || !body.trim()}
              aria-label="Post comment"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
