"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Check, Search, Trophy } from "lucide-react";
import { nominate, type ActionResult } from "@/lib/awards/actions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

type Colleague = {
  id: string;
  name: string;
  jobTitle: string | null;
  siteCode: string;
  avatarUrl?: string | null;
};

/**
 * Nominate as a bottom sheet: pick one person from a searchable list (the same
 * picker as Send), then say why. Replaces the old native <select>.
 */
export function NominateDialog({
  program,
  colleagues,
}: {
  program: { id: string; name: string; points: number; requiresApproval: boolean };
  colleagues: Colleague[];
}) {
  const [open, setOpen] = useState(false);
  const [nomineeId, setNomineeId] = useState("");
  const [q, setQ] = useState("");
  // Toast + close from inside the action (not an effect watching its state).
  const [, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(async (prev, fd) => {
    const res = await nominate(prev, fd);
    if (res.ok) {
      toast.success(res.message ?? "Nomination submitted.");
      setOpen(false);
      setNomineeId("");
    } else {
      toast.error(res.error);
    }
    return res;
  }, undefined);

  const query = q.trim().toLowerCase();
  const list = colleagues.filter(
    (c) =>
      !query ||
      c.name.toLowerCase().includes(query) ||
      (c.jobTitle ?? "").toLowerCase().includes(query) ||
      c.siteCode.toLowerCase().includes(query),
  );
  const chosen = colleagues.find((c) => c.id === nomineeId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="bg-primary text-primary-fg flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold active:opacity-80"
        >
          <Trophy className="size-4" /> Nominate someone
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
        <SheetHeader className="pt-2">
          <SheetTitle className="text-base">Nominate for {program.name}</SheetTitle>
          <SheetDescription>
            {program.requiresApproval
              ? "Your nomination goes to their manager or an admin to approve."
              : "This award is granted straight away."}
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col px-4">
          <input type="hidden" name="programId" value={program.id} />
          <input type="hidden" name="nomineeId" value={nomineeId} />

          {chosen ? (
            <button
              type="button"
              onClick={() => setNomineeId("")}
              className="bg-surface-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
            >
              <UserAvatar name={chosen.name} avatarUrl={chosen.avatarUrl} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{chosen.name}</span>
                <span className="text-muted block text-xs">Tap to change</span>
              </span>
              <Check className="text-primary size-5" />
            </button>
          ) : (
            <>
              <div className="relative">
                <Search className="text-muted absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="search"
                  placeholder="Who deserves it?"
                  className="bg-surface-2 placeholder:text-muted h-11 w-full rounded-full pr-4 pl-10 outline-none"
                />
              </div>
              <ul className="mt-2 max-h-[38svh] overflow-y-auto">
                {list.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setNomineeId(c.id)}
                      className="active:bg-surface-2 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
                    >
                      <UserAvatar name={c.name} avatarUrl={c.avatarUrl} className="size-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.name}</span>
                        <span className="text-muted block truncate text-xs">
                          {[c.jobTitle, c.siteCode].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <textarea
            id="justification"
            name="justification"
            rows={4}
            maxLength={800}
            placeholder="Why do they deserve this?"
            required
            className={cn(
              "bg-surface-2 placeholder:text-muted mt-3 w-full resize-none rounded-2xl px-4 py-3 outline-none",
              !chosen && "hidden",
            )}
          />

          <button
            type="submit"
            disabled={pending || !nomineeId}
            className="bg-primary mt-3 mb-4 h-12 rounded-full font-bold text-white disabled:opacity-40"
          >
            {pending ? "Submitting…" : "Submit nomination"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
