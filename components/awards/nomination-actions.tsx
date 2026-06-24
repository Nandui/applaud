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

export function NominationActions({ id }: { id: string }) {
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
    <div className="flex justify-end gap-1.5">
      <Button
        size="xs"
        disabled={pending}
        onClick={() => run(approveNomination, "Approved")}
      >
        <Check className="size-3.5" /> Approve
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={pending}
        className="text-danger hover:text-danger"
        onClick={() => run(rejectNomination, "Rejected")}
      >
        <X className="size-3.5" /> Reject
      </Button>
    </div>
  );
}
