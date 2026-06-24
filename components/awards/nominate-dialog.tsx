"use client";

import { useActionState, useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(nominate, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Nomination submitted.");
      setOpen(false);
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Award className="size-4" /> Nominate
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
            <Label>Colleague</Label>
            <Select value={nomineeId} onValueChange={setNomineeId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a colleague" />
              </SelectTrigger>
              <SelectContent>
                {colleagues.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.jobTitle ?? "—"} · {c.siteCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="justification">Justification</Label>
            <Textarea
              id="justification"
              name="justification"
              rows={4}
              maxLength={800}
              placeholder="Why do they deserve this award?"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !nomineeId}>
              {pending ? "Submitting…" : "Submit nomination"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
