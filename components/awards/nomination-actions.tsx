"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import {
  approveNomination,
  rejectNomination,
  type ActionResult,
} from "@/lib/awards/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Approve / reject. Full-width thumb-sized buttons by default; `compact` keeps
 * the small inline pair for the admin table.
 */
export function NominationActions({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();

  function run(fn: (fd: FormData) => Promise<ActionResult>, fallback: string) {
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      const res = await fn(fd);
      if (res.ok) toast.success(res.message ?? fallback);
      else toast.error(res.error);
    });
  }

  return (
    <div className={compact ? "flex justify-end gap-1.5" : "grid grid-cols-2 gap-2"}>
      <Button
        size={compact ? "xs" : "default"}
        className={compact ? undefined : "h-10 rounded-xl"}
        disabled={pending}
        onClick={() => run(approveNomination, "Approved")}
      >
        <Check className="size-3.5" /> Approve
      </Button>
      <Button
        size={compact ? "xs" : "default"}
        variant={compact ? "ghost" : "secondary"}
        disabled={pending}
        className={cn("text-danger hover:text-danger", !compact && "h-10 rounded-xl")}
        onClick={() => run(rejectNomination, "Rejected")}
      >
        <X className="size-3.5" /> Reject
      </Button>
    </div>
  );
}
