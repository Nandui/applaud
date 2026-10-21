import Link from "next/link";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

type Person = { id: string; name: string; avatarUrl: string | null };

/**
 * Instagram-style "stories" strip at the top of the feed: a horizontally
 * scrollable row of people (with gradient rings) recently active in the feed,
 * led by the viewer's own bubble with a "+" badge to recognise someone.
 * Tapping a person opens their profile.
 */
export function StoriesRow({
  people,
  viewer,
}: {
  people: Person[];
  viewer: { name: string; avatarUrl?: string | null };
}) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3.5 overflow-x-auto px-4 pt-1 pb-3 md:mx-0 md:px-0">
      <Link
        href="/recognize"
        className="flex w-[4.6rem] shrink-0 snap-start flex-col items-center gap-1.5"
      >
        <span className="relative p-[3px]">
          <UserAvatar
            name={viewer.name}
            avatarUrl={viewer.avatarUrl}
            className="size-[4.1rem] text-base"
          />
          <span className="bg-brand ring-surface absolute right-0.5 bottom-0.5 flex size-6 items-center justify-center rounded-full text-white ring-[3px]">
            <Plus className="size-3.5" strokeWidth={3} />
          </span>
        </span>
        <span className="text-muted w-full truncate text-center text-xs">
          Recognise
        </span>
      </Link>

      {people.map((p) => (
        <Link
          key={p.id}
          href={`/profile/${p.id}`}
          className="flex w-[4.6rem] shrink-0 snap-start flex-col items-center gap-1.5 transition-transform active:scale-95"
        >
          <span className="ring-brand inline-block rounded-full p-[2.5px]">
            <span className="bg-surface block rounded-full p-[2.5px]">
              <UserAvatar
                name={p.name}
                avatarUrl={p.avatarUrl}
                className="size-[3.85rem] text-base"
              />
            </span>
          </span>
          <span className="w-full truncate text-center text-xs">
            {p.name.split(" ")[0]}
          </span>
        </Link>
      ))}
    </div>
  );
}
