"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Megaphone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendJoinNudge } from "@/lib/invite/nudge-action";

export type JoinNudgeProps = {
  appName: string;
  /** People with an account who have never signed in; `due` = can be emailed now (not emailed in the last week). */
  waiting: { name: string; due: boolean }[];
  emailGapDays: number;
  welcomePoints: number;
  last: { at: string; by: string; emails: number; chat: boolean } | null;
  /** Irish time the button opens again, when the last nudge was under a day ago. */
  nextAt: string | null;
  chatReady: boolean;
  mailReady: boolean;
  /** Only production sends. */
  live: boolean;
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function lastLine(last: NonNullable<JoinNudgeProps["last"]>) {
  const where = [
    last.chat ? "posted to Google Chat" : null,
    last.emails ? `emailed ${plural(last.emails, "person", "people")}` : null,
  ].filter(Boolean).join(", ");
  return `Last nudge ${last.at} by ${last.by}${where ? ` · ${where}` : ""}`;
}

export function JoinNudge(props: JoinNudgeProps) {
  const { appName, waiting, last, nextAt, chatReady, mailReady, live } = props;
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const emailable = waiting.filter((p) => p.due).length;
  const skipped = waiting.length - emailable;

  const blocked = !live
    ? "Nudges are only sent from the live site, so previews never message real staff."
    : nextAt
      ? `A nudge went out in the last 24 hours. You can send the next one from ${nextAt}.`
      : !chatReady && !mailReady
        ? "Connect Gmail or Google Chat in Admin > Settings first."
        : !chatReady && emailable === 0
          ? "Everyone waiting was emailed in the last week, and Google Chat isn't connected."
          : null;

  const shown = waiting.slice(0, 12);

  return (
    <section
      aria-labelledby="join-nudge-title"
      className="border-border mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
    >
      <div className="bg-primary/10 text-primary hidden size-10 shrink-0 sm:flex items-center justify-center rounded-full">
        <Megaphone className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 id="join-nudge-title" className="font-semibold">
          {waiting.length
            ? `${plural(waiting.length, "person hasn’t", "people haven’t")} signed in yet`
            : "Everyone with an account has signed in"}
        </h2>
        <p className="text-muted text-sm">
          {last ? lastLine(last) : `Send a friendly nudge about being recognised, earning points and choosing rewards on ${appName}.`}
        </p>
      </div>
      <Button size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        <Megaphone className="size-4" /> Nudge people to join
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nudge people to join {appName}</DialogTitle>
            <DialogDescription>
              An upbeat invite: get recognised, earn points from teammates and managers, spend them on real
              rewards and staff discounts, make your profile yours, plus {props.welcomePoints} welcome points
              for finishing the quick tour.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 text-sm">
            <li className="flex gap-3 rounded-lg border px-3 py-2.5">
              <MessageSquare className={`mt-0.5 size-4 shrink-0 ${chatReady ? "text-primary" : "text-muted"}`} />
              <span>
                <span className="block font-medium">Google Chat space</span>
                <span className="text-muted block text-xs">
                  {chatReady
                    ? `An invite card with a Join ${appName} button, so it reaches staff who don’t have an account yet too.`
                    : "Not connected. Add the space webhook to post here as well."}
                </span>
              </span>
            </li>
            <li className="flex gap-3 rounded-lg border px-3 py-2.5">
              <Mail className={`mt-0.5 size-4 shrink-0 ${mailReady ? "text-primary" : "text-muted"}`} />
              <span>
                <span className="block font-medium">
                  {mailReady ? `Email to ${plural(emailable, "person", "people")}` : "Email"}
                </span>
                <span className="text-muted block text-xs">
                  {!mailReady
                    ? "Gmail isn’t connected, so no emails are sent. Connect it in Admin > Settings."
                    : waiting.length === 0
                      ? "Nobody to email: everyone with an account has signed in."
                      : `A personal invite to each person below.${skipped > 0 ? ` ${plural(skipped, "person was", "people were")} emailed in the last ${props.emailGapDays} days and ${skipped === 1 ? "is" : "are"} skipped (crossed out).` : ""} Nobody gets it more than once a week.`}
                </span>
              </span>
            </li>
          </ul>

          {shown.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {shown.map((p) => (
                <span
                  key={p.name}
                  className={`bg-surface-2 rounded-full px-2 py-0.5 text-xs ${p.due || !mailReady ? "" : "text-muted line-through"}`}
                  title={p.due ? undefined : `Emailed in the last ${props.emailGapDays} days`}
                >
                  {p.name}
                </span>
              ))}
              {waiting.length > shown.length && (
                <span className="text-muted px-1 py-0.5 text-xs">+{waiting.length - shown.length} more</span>
              )}
            </div>
          )}

          {blocked && <p role="status" className="text-warning text-sm">{blocked}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !!blocked}
              onClick={() =>
                start(async () => {
                  const res = await sendJoinNudge();
                  if (res.ok) {
                    toast.success(res.message);
                    setOpen(false);
                  } else toast.error(res.error);
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
              {pending ? "Sending…" : "Send nudge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
