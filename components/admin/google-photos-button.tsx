"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ImageDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyGooglePhotos } from "@/lib/admin/actions";

/**
 * Admin > Users: give everyone who has signed in with Google, and has no
 * picture yet, their Google picture now (otherwise it comes at their next
 * sign-in, or with the daily cron).
 */
export function GooglePhotosButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await applyGooglePhotos();
          if (res.ok) toast.success(res.message ?? "Done.");
          else toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ImageDown className="size-4" />}
      Use Google photos
    </Button>
  );
}
