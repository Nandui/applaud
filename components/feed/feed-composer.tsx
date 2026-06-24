import Link from "next/link";
import { ImagePlus, Sparkles } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

/**
 * Facebook-style "what's on your mind" composer at the top of the feed. It's a
 * lightweight entry point that routes to the full /recognize flow.
 */
export function FeedComposer({
  viewer,
}: {
  viewer: { name: string; avatarUrl?: string | null };
}) {
  return (
    <div className="bg-card border-border rounded-xl border p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <UserAvatar
          name={viewer.name}
          avatarUrl={viewer.avatarUrl}
          className="size-9"
        />
        <Link
          href="/recognize"
          className="bg-secondary text-muted hover:bg-secondary/70 flex h-10 flex-1 items-center rounded-full px-4 text-sm transition-colors"
        >
          Recognise a colleague…
        </Link>
      </div>
      <div className="border-border mt-2 flex items-center gap-1 border-t pt-2">
        <Link
          href="/recognize"
          className="text-muted hover:bg-secondary flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-colors"
        >
          <ImagePlus className="text-accent size-4" /> Photo/GIF
        </Link>
        <Link
          href="/recognize"
          className="text-muted hover:bg-secondary flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-colors"
        >
          <Sparkles className="text-primary size-4" /> Recognise
        </Link>
      </div>
    </div>
  );
}
