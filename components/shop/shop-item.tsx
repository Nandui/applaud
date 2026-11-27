"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Crown } from "lucide-react";
import { buyItem, equipItem } from "@/lib/profile-actions";
import {
  DEFAULT_BANNER,
  DEFAULT_THEME,
  KIND_LABELS,
  RARITY,
  bannerCss,
  frameArt,
  type Cosmetic,
  type CosmeticKind,
  type Look,
  type Rarity,
} from "@/lib/cosmetics";
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
import { PopOnChange } from "@/components/fx/pop-on-change";
import { NewLabel } from "@/components/app-shell/new-items";

export type Wearer = {
  name: string;
  avatarUrl: string | null;
  /** What they look like now, ready to draw. */
  look: Look;
  /** The item ids they wear in each slot (null = nothing, or the default). */
  worn: Record<CosmeticKind, string | null>;
  /** The rarity of the frame they wear, for its shimmer. */
  frameRarity: Rarity | null;
};

/** Their look with this item swapped in, for the try-it-on preview. */
export function lookWith(look: Look, item: Cosmetic): Look {
  if (item.kind === "frame") return { ...look, frame: frameArt(item) };
  if (item.kind === "banner") return { ...look, banner: bannerCss(item) };
  return { ...look, theme: item.style ?? look.theme };
}

const DEFAULTS: Partial<Record<CosmeticKind, string>> = { banner: DEFAULT_BANNER, theme: DEFAULT_THEME };

/** The item itself, drawn small: a framed avatar, a banner strip or a colour. */
function ItemArt({ item, me }: { item: Cosmetic; me: Wearer }) {
  if (item.kind === "frame") {
    return (
      <span className="flex h-full items-center justify-center">
        <FramedAvatar name={me.name} avatarUrl={me.avatarUrl} frame={frameArt(item)} className="size-14" gapClassName="bg-surface" />
      </span>
    );
  }
  if (item.kind === "banner") {
    return <span className="block h-full w-full" style={{ background: bannerCss(item) }} />;
  }
  return (
    <span className="flex h-full items-center justify-center">
      <span className="size-12 rounded-full" style={{ backgroundColor: item.style ?? undefined }} />
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
  isNew = false,
  perk = null,
}: {
  item: Cosmetic;
  me: Wearer;
  owned: boolean;
  balance: number;
  /** Added since this person last looked at the shop. */
  isNew?: boolean;
  /** Their rank label when the shop is free for them (every rank above Staff). */
  perk?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const worn = me.worn[item.kind];
  const wearing = worn === item.id || (!worn && DEFAULTS[item.kind] === item.id);
  // Free for them thanks to their rank, though it has a price for everyone else.
  const perkFree = perk !== null && item.price > 0;
  const free = item.price === 0 || perkFree;
  const short = free ? 0 : item.price - balance;
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

  const preview = lookWith(me.look, item);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" data-open-id={item.id} className="text-left transition-opacity active:opacity-70">
          {/* Bounces when it's put on or taken off. */}
          <PopOnChange value={String(wearing)} className="block w-full">
            <span className="bg-surface border-border relative block aspect-square w-full overflow-hidden rounded-xl border">
              <ItemArt item={item} me={me} />
              {isNew && !owned ? <NewLabel className="absolute top-1.5 left-1.5" /> : null}
              {wearing ? (
                <span className="bg-foreground text-background absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
            </span>
          </PopOnChange>
          <span className="mt-1.5 block truncate text-sm font-semibold">{item.name}</span>
          <span className="flex items-center justify-between gap-1 text-xs">
            <span style={{ color: rarity.color }} className="font-semibold">
              {rarity.label}
            </span>
            {perkFree && !owned ? (
              <span className="flex min-w-0 items-baseline gap-1" data-numeric>
                <span className="text-muted truncate line-through">{pts(item.price)}</span>
                <span className="text-primary font-bold">Free</span>
              </span>
            ) : (
              <span className="text-muted font-medium" data-numeric>
                {owned ? "Owned" : free ? "Free" : pts(item.price)}
              </span>
            )}
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
          <ProfilePreview
            name={me.name}
            avatarUrl={me.avatarUrl}
            look={preview}
            frameRarity={item.kind === "frame" ? item.rarity : me.frameRarity}
          />
        </div>
        <div className="pb-safe mt-4 space-y-2 px-4 pb-4">
          {!owned ? (
            <>
              {perkFree ? <PerkNote perk={perk} price={item.price} /> : null}
              <button
                type="button"
                disabled={pending || short > 0}
                onClick={() => run(() => buyItem(item.id))}
                className="bg-primary text-primary-fg h-12 w-full rounded-xl font-semibold transition-opacity active:opacity-80 disabled:opacity-40"
              >
                {pending
                  ? free
                    ? "Getting it…"
                    : "Buying…"
                  : free
                    ? "Get it free"
                    : short > 0
                      ? `You need ${pts(short)} more`
                      : `Buy for ${pts(item.price)}`}
              </button>
              <p className="text-muted text-center text-xs" data-numeric>
                {perkFree
                  ? "Nothing comes off your points."
                  : free
                  ? "Free, but only for people who grab it here."
                  : `You have ${formatNumber(balance)} pts${short <= 0 ? ` · ${formatNumber(balance - item.price)} left after` : ""}`}
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

/** The "free just for you" strip in a buy sheet: the struck-through price and why it's free. */
export function PerkNote({ perk, price, items }: { perk: string; price: number; items?: number }) {
  return (
    <div className="bg-primary/10 text-foreground flex items-center gap-3 rounded-xl px-3 py-2.5">
      <Crown className="text-primary size-5 shrink-0" aria-hidden />
      <p className="min-w-0 text-sm leading-snug">
        <span className="font-semibold">Free for you as {perk}.</span>{" "}
        <span className="text-muted" data-numeric>
          Staff pay <span className="whitespace-nowrap line-through">{pts(price)}</span>
          {items && items > 1 ? ` for these ${items}` : ""}.
        </span>
      </p>
    </div>
  );
}
