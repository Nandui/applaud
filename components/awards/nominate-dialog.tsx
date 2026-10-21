"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Award } from "lucide-react";
import { nominate, type ActionResult } from "@/lib/awards/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Colleague = {
  id: string;
  name: string;
  jobTitle: string | null;
  siteCode: string;
};

export function NominateDialog({
  program,
  colleagues,
}: {
  program: { id: string; name: string; points: number; requiresApproval: boolean };
  colleagues: Colleague[];
}) {
  const [open, setOpen] = useState(false);
  const [nomineeId, setNomineeId] = useState("");
  // Toast + close from inside the action (not an effect watching its state).
  const [, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(async (prev, fd) => {
    const res = await nominate(prev, fd);
    if (res.ok) {
      toast.success(res.message ?? "Nomination submitted.");
      setOpen(false);
    } else {
      toast.error(res.error);
    }
    return res;
  }, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 w-full rounded-full">
          <Award className="size-4" /> Nominate someone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nominate for {program.name}</DialogTitle>
          <DialogDescription>
            {program.requiresApproval
              ? "Your nomination goes to a manager or admin for approval."
              : "This award is granted immediately."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="programId" value={program.id} />
          <input type="hidden" name="nomineeId" value={nomineeId} />

          <div className="space-y-1.5">
            <Label htmlFor="nominee">Colleague</Label>
            {/* Native select: phones open their own picker wheel/list. */}
            <select
              id="nominee"
              value={nomineeId}
              onChange={(e) => setNomineeId(e.target.value)}
              className="border-input bg-surface h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="" disabled>
                Choose a colleague
              </option>
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.jobTitle ?? "—"}
                  {c.siteCode ? ` · ${c.siteCode}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="justification">Justification</Label>
            <Textarea
              id="justification"
              name="justification"
              rows={4}
              maxLength={800}
              placeholder="Why do they deserve this award?"
              className="rounded-xl"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-full" disabled={pending || !nomineeId}>
              {pending ? "Submitting…" : "Submit nomination"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
