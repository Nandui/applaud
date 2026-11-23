"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { Reorder, useDragControls } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  BadgePercent,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  Info,
  Loader2,
  MapPin,
  Pencil,
  Smartphone,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { saveRewardLayout } from "@/lib/rewards/actions";
import {
  categoryOf,
  flattenLayout,
  isOnShow,
  moveItem,
  offeringStatus,
  shopLayout,
  type OfferingStatus,
} from "@/lib/rewards/layout";
import { PROMO_LABELS, isPromoTag, promoState } from "@/lib/reward-promo";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RewardRow } from "@/components/admin/rewards-manager";

export type BudgetContext = { spentCents: number; budgetCents: number; resetsOn: string };
type SiteOption = { id: string; name: string };

/** Local, editable copy of the page's sections, as ids. */
type IdLayout = {
  discounts: string[];
  featured: string[];
  categories: { name: string; ids: string[] }[];
};

function toIdLayout(rows: RewardRow[]): IdLayout {
  const l = shopLayout(rows);
  return {
    discounts: l.discounts.map((r) => r.id),
    featured: l.featured.map((r) => r.id),
    categories: l.categories.map((c) => ({ name: c.name, ids: c.items.map((r) => r.id) })),
  };
}

const WIDE = "(min-width: 1024px)";
function subscribeWide(cb: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const noSubscribe = () => () => {};
function readPreviewPref(): string | null {
  try {
    return window.localStorage.getItem("rewards-preview");
  } catch {
    return null;
  }
}

/** How many cards a phone shows in a swipe row before you have to swipe. */
const FIRST_SCREEN = { discounts: 1, featured: 2 } as const;

/**
 * Admin > Rewards, "Page layout": the offerings grouped exactly like the staff
 * Rewards page (Staff discounts, Featured, then each category), each section
 * reorderable by dragging the handle, with the arrow buttons, or with the
 * arrow keys on a focused handle. Every move saves straight away and reloads
 * the phone preview beside it.
 */
export function RewardsLayoutEditor({
  rows,
  sites,
  budget,
  onEdit,
}: {
  rows: RewardRow[];
  sites: SiteOption[];
  budget: BudgetContext;
  onEdit: (row: RewardRow) => void;
}) {
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const [layout, setLayout] = useState<IdLayout>(() => toIdLayout(rows));
  // Fresh rows from the server (after a save or an edit) replace the local copy.
  const [fromServer, setFromServer] = useState(rows);
  if (fromServer !== rows) {
    setFromServer(rows);
    setLayout(toIdLayout(rows));
  }
  // The newest layout, readable straight after a change (state lags a render).
  const latest = useRef(layout);
  useEffect(() => {
    latest.current = layout;
  }, [layout]);
  function apply(next: IdLayout) {
    latest.current = next;
    setLayout(next);
  }

  const [saving, startSave] = useTransition();
  const [version, setVersion] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  // Desktop: a panel pinned over the left-hand navigation, open by default so
  // the page and its list sit side by side. Phones: shown above the list on demand.
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
  const saved = useSyncExternalStore(noSubscribe, readPreviewPref, () => null);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const showPreview = chosen ?? (saved ? saved === "on" : wide);
  function togglePreview(on: boolean) {
    setChosen(on);
    try {
      window.localStorage.setItem("rewards-preview", on ? "on" : "off");
    } catch {}
  }

  function commit(next?: IdLayout) {
    if (next) apply(next);
    const l = latest.current;
    const order = flattenLayout({
      discounts: l.discounts.map((id) => ({ id })),
      categories: l.categories.map((c) => ({ name: c.name, items: c.ids.map((id) => ({ id })) })),
    });
    startSave(async () => {
      const res = await saveRewardLayout({ order, featured: l.featured });
      if (!res.ok) {
        toast.error(res.error);
        setLayout(toIdLayout(rows));
      } else {
        setVersion((v) => v + 1);
      }
    });
  }

  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? "one site";
  const statusOf = (r: RewardRow) => offeringStatus(r, { ...budget, siteName });

  const withSection = (key: "discounts" | "featured", ids: string[]): IdLayout => ({ ...latest.current, [key]: ids });
  const withCategory = (name: string, ids: string[]): IdLayout => ({
    ...latest.current,
    categories: latest.current.categories.map((c) => (c.name === name ? { ...c, ids } : c)),
  });

  const onShowCount = rows.filter((r) => isOnShow(r)).length;

  return (
    <div>
      <div className="min-w-0 space-y-5">
        <div className="bg-secondary flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3 text-sm">
          <p className="w-full sm:w-auto sm:min-w-0 sm:flex-1">
            This is the staff Rewards page from top to bottom.{" "}
            <span className="text-muted">
              Drag <GripVertical className="inline size-3.5 align-[-2px]" /> or use the arrows to move an offering
              within its section. Changes save straight away.
            </span>
          </p>
          <span className="text-muted flex items-center gap-2 text-xs" data-numeric>
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Saving…
              </>
            ) : (
              `${onShowCount} of ${rows.length} on show`
            )}
          </span>
          <Button size="sm" variant={showPreview ? "secondary" : "default"} onClick={() => togglePreview(!showPreview)}>
            <Smartphone className="size-4" /> {showPreview ? "Hide phone preview" : "Show phone preview"}
          </Button>
        </div>

        {showPreview && !wide ? <PhonePreview sites={sites} version={version} focus={focus} /> : null}

        <Section
          step={1}
          icon={<BadgePercent className="size-4" />}
          title="Staff discounts"
          where="Top of the page, in a violet panel. One card shows at a time on phones; staff swipe for the rest."
          empty="No staff discounts. Add one with New offering, type Staff discount."
          count={layout.discounts.length}
        >
          <SortableList
            ids={layout.discounts}
            byId={byId}
            statusOf={statusOf}
            firstScreen={FIRST_SCREEN.discounts}
            onChange={(ids) => apply(withSection("discounts", ids))}
            onCommit={(ids) => commit(ids ? withSection("discounts", ids) : undefined)}
            onEdit={onEdit}
            onFocus={setFocus}
            focus={focus}
          />
        </Section>

        <Section
          step={2}
          icon={<Sparkles className="size-4" />}
          title="Featured"
          where="Under the balance, a swipe row of every reward with a running label (Featured, Last chance…). They also stay in their category."
          empty="Nothing featured. Give a reward a shop label to put it here."
          count={layout.featured.length}
        >
          <SortableList
            ids={layout.featured}
            byId={byId}
            statusOf={statusOf}
            firstScreen={FIRST_SCREEN.featured}
            onChange={(ids) => apply(withSection("featured", ids))}
            onCommit={(ids) => commit(ids ? withSection("featured", ids) : undefined)}
            onEdit={onEdit}
            onFocus={setFocus}
            focus={focus}
          />
        </Section>

        <Section
          step={3}
          title="Categories"
          where="Then one section per category, two cards per row on phones. Move a whole category with its arrows; with more than one, staff also get category chips to filter."
          empty="No rewards yet."
          count={layout.categories.length}
        >
          {layout.categories.length > 0 ? (
            <div className="space-y-3">
              {layout.categories.map((cat, i) => (
                <div key={cat.name} className="border-border rounded-xl border" data-category-block={cat.name}>
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <span className="text-muted w-5 text-center text-xs font-bold" data-numeric>
                      {i + 1}
                    </span>
                    <h4 className="min-w-0 flex-1 truncate text-sm font-bold">{cat.name}</h4>
                    <span className="text-muted text-xs" data-numeric>
                      {cat.ids.length} offering{cat.ids.length === 1 ? "" : "s"}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={i === 0 || saving}
                        aria-label={`Move ${cat.name} up`}
                        onClick={() => commit({ ...latest.current, categories: moveItem(latest.current.categories, i, -1) })}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={i === layout.categories.length - 1 || saving}
                        aria-label={`Move ${cat.name} down`}
                        onClick={() => commit({ ...latest.current, categories: moveItem(latest.current.categories, i, 1) })}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-1.5">
                    <SortableList
                      ids={cat.ids}
                      byId={byId}
                      statusOf={statusOf}
                      onChange={(ids) => apply(withCategory(cat.name, ids))}
                      onCommit={(ids) => commit(ids ? withCategory(cat.name, ids) : undefined)}
                      onEdit={onEdit}
                      onFocus={setFocus}
                      focus={focus}
                      gridHint
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Section>
      </div>

      {/* Portalled: the page transition's transform would otherwise pin it to the content column. */}
      {showPreview && wide ? createPortal(
        <aside
          aria-label="Phone preview"
          className="bg-background border-border fixed inset-y-0 left-0 z-40 w-[440px] overflow-y-auto border-r p-5 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold">Staff Rewards page</p>
              <p className="text-muted text-xs">Live: reloads after every change.</p>
            </div>
            <Button size="icon-sm" variant="ghost" aria-label="Hide phone preview" onClick={() => togglePreview(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <PhonePreview sites={sites} version={version} focus={focus} />
        </aside>,
        document.body,
      ) : null}
    </div>
  );
}

function Section({
  step,
  icon,
  title,
  where,
  empty,
  count,
  children,
}: {
  count: number;
  step: number;
  icon?: React.ReactNode;
  title: string;
  where: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-2xl p-3 ring-1 ring-black/5 dark:ring-white/10">
      <header className="mb-2 flex items-start gap-3 px-1">
        <span className="bg-primary text-primary-fg flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-[0.95rem] font-bold">
            {icon}
            {title}
          </h3>
          <p className="text-muted text-xs leading-snug">{where}</p>
        </div>
      </header>
      {count > 0 ? children : <p className="text-muted px-1 py-3 text-sm">{empty}</p>}
    </section>
  );
}

function SortableList({
  ids,
  byId,
  statusOf,
  firstScreen,
  gridHint,
  onChange,
  onCommit,
  onEdit,
  onFocus,
  focus,
}: {
  ids: string[];
  byId: Map<string, RewardRow>;
  statusOf: (r: RewardRow) => OfferingStatus[];
  /** Cards visible on a phone before swiping: draws a line after that many on-show offerings. */
  firstScreen?: number;
  /** Category grids: say which row of two each offering lands in. */
  gridHint?: boolean;
  onChange: (ids: string[]) => void;
  /** Save: with the new ids after an arrow move, without after a drag. */
  onCommit: (ids?: string[]) => void;
  onEdit: (row: RewardRow) => void;
  onFocus: (id: string | null) => void;
  focus: string | null;
}) {
  if (ids.length === 0) return null;
  // Positions as staff see them: hidden offerings don't take a place.
  let shown = 0;
  const places = ids.map((id) => {
    const r = byId.get(id);
    return r && isOnShow(r) ? ++shown : null;
  });

  function move(index: number, delta: number) {
    const next = moveItem(ids, index, delta);
    if (next.every((id, i) => id === ids[i])) return;
    onCommit(next);
  }

  return (
    <Reorder.Group axis="y" values={ids} onReorder={onChange} className="space-y-1">
      {ids.map((id, i) => {
        const row = byId.get(id);
        if (!row) return null;
        const place = places[i];
        const divider = firstScreen !== undefined && place === firstScreen && shown > firstScreen;
        return (
          <SortableRow
            key={id}
            row={row}
            index={i}
            count={ids.length}
            place={place}
            gridHint={gridHint}
            divider={divider ? "Phones need a swipe to see the ones below" : null}
            statuses={statusOf(row)}
            onMove={move}
            onDragEnd={() => onCommit()}
            onEdit={onEdit}
            onFocus={onFocus}
            focused={focus === id}
          />
        );
      })}
    </Reorder.Group>
  );
}

const TONE: Record<OfferingStatus["tone"], { cls: string; icon: React.ReactNode }> = {
  hidden: { cls: "bg-foreground/8 text-foreground", icon: <EyeOff className="size-3" /> },
  warn: { cls: "bg-warning/15 text-warning", icon: <TriangleAlert className="size-3" /> },
  info: { cls: "bg-secondary text-muted", icon: <Info className="size-3" /> },
};

function SortableRow({
  row,
  index,
  count,
  place,
  gridHint,
  divider,
  statuses,
  onMove,
  onDragEnd,
  onEdit,
  onFocus,
  focused,
}: {
  row: RewardRow;
  index: number;
  count: number;
  place: number | null;
  gridHint?: boolean;
  divider: string | null;
  statuses: OfferingStatus[];
  onMove: (index: number, delta: number) => void;
  onDragEnd: () => void;
  onEdit: (row: RewardRow) => void;
  onFocus: (id: string | null) => void;
  focused: boolean;
}) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const promo = promoState(row);
  const hidden = place === null;
  const discount = row.kind === "discount";
  const siteNote = statuses.find((s) => s.text.startsWith("Only staff at"));

  return (
    <Reorder.Item
      value={row.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
      className="relative list-none"
      data-reward-row={row.id}
    >
      <div
        className={cn(
          "bg-background flex items-center gap-2 rounded-xl p-1.5 pr-2 transition-shadow",
          dragging && "ring-primary/40 shadow-lg ring-2",
          focused && "ring-primary ring-2",
        )}
      >
        <button
          type="button"
          aria-label={`Move ${row.name}. Use the up and down arrow keys.`}
          title="Drag to move, or focus and use the arrow keys"
          className="text-muted hover:bg-secondary focus-visible:ring-primary flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md outline-none focus-visible:ring-2 active:cursor-grabbing"
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              onMove(index, e.key === "ArrowUp" ? -1 : 1);
              // Keep focus on the handle as it moves.
              const id = row.id;
              requestAnimationFrame(() =>
                document.querySelector<HTMLElement>(`[data-reward-row="${CSS.escape(id)}"] button`)?.focus(),
              );
            }
          }}
        >
          <GripVertical className="size-4" />
        </button>

        <span
          className={cn(
            "w-7 shrink-0 text-center text-xs font-bold",
            hidden ? "text-muted" : "text-foreground",
          )}
          data-numeric
          title={hidden ? "Not on show, so it takes no place" : "Place staff see it in"}
        >
          {hidden ? "–" : `#${place}`}
        </span>

        <span
          className={cn(
            "relative hidden size-11 shrink-0 overflow-hidden rounded-lg sm:block",
            hidden && "opacity-45 grayscale",
          )}
        >
          {row.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="bg-secondary text-muted flex size-full items-center justify-center text-[10px]">
              No pic
            </span>
          )}
        </span>

        <div className={cn("min-w-0 flex-1", hidden && "opacity-60")}>
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm leading-tight font-semibold">
            <span className="line-clamp-2 break-words">{row.name}</span>
            {promo.tag ? (
              <span className="bg-foreground text-background shrink-0 rounded-full px-1.5 py-0.5 text-[0.62rem] leading-none font-bold">
                {promo.label}
              </span>
            ) : isPromoTag(row.promoTag) ? (
              <span className="text-muted shrink-0 text-[0.62rem] line-through">{PROMO_LABELS[row.promoTag]}</span>
            ) : null}
          </p>
          <p className="text-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs" data-numeric>
            {discount ? (
              <span className="text-primary font-semibold">{row.discountText}</span>
            ) : (
              <span>
                ✦ {formatNumber(promo.pointsCost)}
                {promo.wasPointsCost ? <s className="ml-1">{formatNumber(promo.wasPointsCost)}</s> : null}
              </span>
            )}
            {!discount && row.category ? <span>{categoryOf(row)}</span> : null}
            {gridHint && place !== null ? (
              <span>
                Row {Math.ceil(place / 2)}, {place % 2 === 1 ? "left" : "right"}
              </span>
            ) : null}
            {siteNote ? (
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" />
                {siteNote.text.replace(/^Only staff at /, "").replace(/ see it$/, "")}
              </span>
            ) : null}
          </p>
          {statuses.some((s) => s !== siteNote) ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {statuses
                .filter((s) => s !== siteNote)
                .map((s) => (
                  <span
                    key={s.text}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.68rem] leading-none font-semibold",
                      TONE[s.tone].cls,
                    )}
                  >
                    {TONE[s.tone].icon}
                    {s.text}
                  </span>
                ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={index === 0}
            aria-label={`Move ${row.name} up`}
            onClick={() => onMove(index, -1)}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={index === count - 1}
            aria-label={`Move ${row.name} down`}
            onClick={() => onMove(index, 1)}
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant={focused ? "secondary" : "ghost"}
            disabled={hidden}
            aria-label={`Show ${row.name} in the preview`}
            title={hidden ? "Not on show" : "Find it in the phone preview"}
            onClick={() => onFocus(focused ? null : row.id)}
          >
            <Eye className="size-3.5" />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label={`Edit ${row.name}`} onClick={() => onEdit(row)}>
            <Pencil className="size-3.5" />
          </Button>
        </div>
      </div>
      {divider ? (
        <p className="text-muted my-1.5 flex items-center gap-2 px-2 text-[0.68rem] font-semibold tracking-wide uppercase">
          <span className="border-primary/40 flex-1 border-t border-dashed" />
          {divider}
          <span className="border-primary/40 flex-1 border-t border-dashed" />
        </p>
      ) : null}
    </Reorder.Item>
  );
}

const ALL = "all";

/** Today as YYYY-MM-DD in Irish time, for the date picker. */
function todayInput(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * The real staff Rewards page in a phone-sized frame, as someone at the chosen
 * site sees it on the chosen day. Reloads after every save.
 */
function PhonePreview({ sites, version, focus }: { sites: SiteOption[]; version: number; focus: string | null }) {
  const [site, setSite] = useState(ALL);
  const [day, setDay] = useState("");
  const [loading, setLoading] = useState(true);
  const today = todayInput();
  const q = new URLSearchParams({ site });
  if (day && day !== today) q.set("at", day);
  if (focus) q.set("focus", focus);
  q.set("v", String(version));
  const src = `/admin-preview/rewards?${q}`;
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setLoading(true);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Seen by staff at</Label>
          <Select
            value={site}
            onValueChange={(v) => setSite(v ?? ALL)}
            items={{ [ALL]: "Any site (all-sites only)", ...Object.fromEntries(sites.map((s) => [s.id, s.name])) }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any site (all-sites only)</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="preview-day" className="text-xs">
            On
          </Label>
          <Input
            id="preview-day"
            type="date"
            value={day || today}
            min={today}
            onChange={(e) => setDay(e.target.value)}
            className="h-8"
          />
        </div>
      </div>

      <div className="relative mx-auto w-[390px] max-w-full">
        <div className="bg-foreground rounded-[2.6rem] p-2.5 shadow-xl">
          <div className="bg-background relative h-[min(720px,calc(100vh-190px))] min-h-[480px] overflow-hidden rounded-[2.1rem]">
            <iframe
              key={src}
              src={src}
              title="Staff Rewards page preview"
              className="size-full"
              onLoad={() => setLoading(false)}
            />
            {loading ? (
              <div className="bg-background/60 absolute inset-0 flex items-center justify-center">
                <Loader2 className="text-muted size-6 animate-spin" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <p className="text-muted flex items-center justify-between gap-2 px-1 text-xs">
        <span>Look only: taps do nothing here. Uses your own points balance.</span>
        <a
          href={src.replace(/([?&])v=\d+/, "$1")}
          target="_blank"
          rel="noreferrer"
          className="text-primary inline-flex shrink-0 items-center gap-1 font-semibold"
        >
          Open <ExternalLink className="size-3" />
        </a>
      </p>
    </div>
  );
}
