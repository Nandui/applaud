import Link from "next/link";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

type Person = { id: string; name: string; avatarUrl: string | null };

/**
 * Instagram-style "stories" strip at the top of the feed: a horizontally
 * scrollable row of people (with gradient rings) recently active in the feed,
 * led by a "Recognise" create bubble. Tapping a person opens their profile.
 */
export function StoriesRow({ people }: { people: Person[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        href="/recognize"
        className="flex w-16 shrink-0 flex-col items-center gap-1"
      >
        <span className="border-primary text-primary flex size-16 items-center justify-center rounded-full border-2 border-dashed">
          <Plus className="size-6" />
        </span>
        <span className="text-muted w-full truncate text-center text-xs">
          Recognise
        </span>
      </Link>

      {people.map((p) => (
        <Link
          key={p.id}
          href={`/profile/${p.id}`}
          className="flex w-16 shrink-0 flex-col items-center gap-1"
        >
          <span className="from-primary to-accent inline-block rounded-full bg-gradient-to-tr p-[2px]">
            <span className="bg-card block rounded-full p-[2px]">
              <UserAvatar
                name={p.name}
                avatarUrl={p.avatarUrl}
                className="size-14"
              />
            </span>
          </span>
          <span className="text-muted w-full truncate text-center text-xs">
            {p.name.split(" ")[0]}
          </span>
        </Link>
      ))}
    </div>
  );
}
