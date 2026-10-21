"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { buyItem, equipItem } from "@/lib/profile-actions";
import { KIND_LABELS, RARITY, type Cosmetic } from "@/lib/cosmetics";
import { formatNumber, pts } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FramedAvatar } from "@/components/user-avatar";
import { ProfilePreview } from "@/components/shop/profile-preview";

export type Wearer = {
  name: string;
  avatarUrl: string | null;
  frame: string | null;
  banner: string | null;
  theme: string | null;
};

/** The item itself, drawn small: a framed avatar, a banner strip or a colour. */
function ItemArt({ item, me }: { item: Cosmetic; me: Wearer }) {
  if (item.kind === "frame") {
    return (
      <span className="flex h-full items-center justify-center">
        <FramedAvatar name={me.name} avatarUrl={me.avatarUrl} frame={item.id} className="size-14" gapClassName="bg-surface" />
      </span>
    );
  }
  if (item.kind === "banner") {
    return <span className="block h-full w-full" style={{ background: item.style }} />;
  }
  return (
    <span className="flex h-full items-center justify-center">
      <span className="size-12 rounded-full" style={{ backgroundColor: item.style }} />
    </span>
  );
}

/**
 * One shop tile. Tapping it opens a sheet that shows the item on your own
 * profile, with Buy, Equip or Remove depending on whether you own and wear it.
 */
export function ShopItem({
  item,
  me,
  owned,
  balance,
}: {
  item: Cosmetic;
  me: Wearer;
  owned: boolean;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const wearing = me[item.kind] === item.id || (!me[item.kind] && item.price === 0 && item.kind !== "frame");
  const short = item.price - balance;
  const rarity = RARITY[item.rarity];

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        setOpen(false);
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });

  const preview = { ...me, [item.kind]: item.id };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="text-left transition-opacity active:opacity-70">
          <span className="bg-surface border-border relative block aspect-square overflow-hidden rounded-xl border">
            <ItemArt item={item} me={me} />
            {wearing ? (
              <span className="bg-foreground text-background absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : null}
          </span>
          <span className="mt-1.5 block truncate text-sm font-semibold">{item.name}</span>
          <span className="flex items-center justify-between gap-1 text-xs">
            <span style={{ color: rarity.color }} className="font-semibold">
              {rarity.label}
            </span>
            <span className="text-muted font-medium" data-numeric>
              {owned ? "Owned" : item.price === 0 ? "Free" : pts(item.price)}
            </span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="gap-0 px-0">
        <SheetHeader className="pt-2 text-left">
          <p className="text-xs font-semibold" style={{ color: rarity.color }}>
            {rarity.label} · {KIND_LABELS[item.kind].one}
          </p>
          <SheetTitle className="text-xl font-bold">{item.name}</SheetTitle>
          <SheetDescription>This is how it looks on your profile.</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <ProfilePreview {...preview} />
        </div>
        <div className="pb-safe mt-4 space-y-2 px-4 pb-4">
          {!owned ? (
            <>
              <button
                type="button"
                disabled={pending || short > 0}
                onClick={() => run(() => buyItem(item.id))}
                className="bg-primary text-primary-fg h-12 w-full rounded-xl font-semibold transition-opacity active:opacity-80 disabled:opacity-40"
              >
                {pending
                  ? "Buying…"
                  : short > 0
                    ? `You need ${pts(short)} more`
                    : `Buy for ${pts(item.price)}`}
              </button>
              <p className="text-muted text-center text-xs" data-numeric>
                You have {formatNumber(balance)} pts
                {short <= 0 ? ` · ${formatNumber(balance - item.price)} left after` : ""}
              </p>
            </>
          ) : wearing ? (
            item.kind === "frame" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => equipItem(item.kind, null))}
                className="bg-surface-2 h-12 w-full rounded-xl font-semibold disabled:opacity-40"
              >
                Take it off
              </button>
            ) : (
              <p className="text-muted py-3 text-center text-sm font-medium">You&apos;re wearing this</p>
            )
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => equipItem(item.kind, item.id))}
              className="bg-primary text-primary-fg h-12 w-full rounded-xl font-semibold transition-opacity active:opacity-80 disabled:opacity-40"
            >
              {pending ? "Saving…" : "Use this"}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
