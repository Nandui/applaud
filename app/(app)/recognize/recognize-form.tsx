"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Search, X, Sparkles } from "lucide-react";
import { createRecognition, type ActionResult } from "@/lib/recognition/actions";
import type { AllowanceStatus } from "@/lib/points";
import { valueIcon } from "@/lib/value-icons";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { pts } from "@/lib/format";
import { cn } from "@/lib/utils";

type ValueOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};
type RecipientOption = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  siteCode: string;
};

export function RecognizeForm({
  values,
  recipients,
  allowance,
}: {
  values: ValueOption[];
  recipients: RecipientOption[];
  allowance: AllowanceStatus;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    createRecognition,
    undefined,
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [valueId, setValueId] = useState<string>("");
  const [points, setPoints] = useState<number>(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [search, setSearch] = useState("");

  const byId = useMemo(
    () => new Map(recipients.map((r) => [r.id, r])),
    [recipients],
  );

  const maxPerRecipient =
    selected.length > 0
      ? Math.floor(allowance.remaining / selected.length)
      : allowance.remaining;

  // Keep points within what the allowance permits as the selection changes.
  useEffect(() => {
    if (points > maxPerRecipient) setPoints(Math.max(0, maxPerRecipient));
  }, [maxPerRecipient, points]);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Recognition posted!");
      router.push("/");
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const totalPoints = points * selected.length;
  const remainingAfter = allowance.remaining - totalPoints;

  const filtered = recipients.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (r.jobTitle ?? "").toLowerCase().includes(q) ||
      r.siteCode.toLowerCase().includes(q)
    );
  });

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const canSubmit =
    selected.length > 0 && valueId !== "" && !pending;

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden fields the server action reads */}
      {selected.map((id) => (
        <input key={id} type="hidden" name="recipientIds" value={id} />
      ))}
      <input type="hidden" name="valueId" value={valueId} />
      <input type="hidden" name="points" value={points} />
      <input type="hidden" name="visibility" value={isPrivate ? "private" : "public"} />

      <Card>
        <CardContent className="space-y-5">
          {/* Recipients */}
          <div className="space-y-2">
            <Label>Recipients</Label>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((id) => {
                  const r = byId.get(id);
                  if (!r) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className="bg-primary/10 text-primary hover:bg-primary/15 flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-2.5 text-sm font-medium transition-colors"
                    >
                      {r.name}
                      <X className="size-3.5" />
                    </button>
                  );
                })}
              </div>
            )}
            <div className="relative">
              <Search className="text-muted absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search colleagues…"
                className="pl-9"
              />
            </div>
            <div className="border-border max-h-56 divide-y overflow-y-auto rounded-lg border">
              {filtered.length === 0 ? (
                <p className="text-muted p-4 text-center text-sm">No matches.</p>
              ) : (
                filtered.map((r) => {
                  const active = selected.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggle(r.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                        active ? "bg-primary/5" : "hover:bg-secondary",
                      )}
                    >
                      <UserAvatar
                        name={r.name}
                        avatarUrl={r.avatarUrl}
                        className="size-8"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        <p className="text-muted truncate text-xs">
                          {r.jobTitle ?? "—"} · {r.siteCode}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {active && <Check className="size-3.5" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label>Value</Label>
            <div className="flex flex-wrap gap-2">
              {values.map((v) => {
                const Icon = valueIcon(v.icon);
                const active = valueId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setValueId(active ? "" : v.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-secondary",
                    )}
                    style={
                      active && v.color
                        ? { color: v.color, borderColor: v.color }
                        : undefined
                    }
                  >
                    <Icon className="size-4" />
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="What did they do? Be specific."
              rows={3}
              maxLength={500}
              required
            />
          </div>

          {/* Points */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="points-input">Points each (optional)</Label>
              <span className="text-muted text-xs">
                <span data-numeric>{allowance.remaining}</span> of{" "}
                <span data-numeric>{allowance.total}</span> allowance left
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="points-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={maxPerRecipient}
                value={points}
                onChange={(e) =>
                  setPoints(
                    Math.max(
                      0,
                      Math.min(maxPerRecipient, Number(e.target.value) || 0),
                    ),
                  )
                }
                className="font-mono w-28"
                disabled={allowance.remaining === 0}
              />
              <div className="flex gap-1">
                {[10, 25, 50].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={n > maxPerRecipient}
                    onClick={() => setPoints(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            {selected.length > 0 && points > 0 && (
              <p className="text-muted text-xs">
                {pts(points)} × {selected.length}{" "}
                {selected.length === 1 ? "recipient" : "recipients"} ={" "}
                <span data-numeric className="text-foreground font-medium">
                  {totalPoints}
                </span>{" "}
                pts · <span data-numeric>{remainingAfter}</span> left after
              </p>
            )}
          </div>

          {/* Visibility */}
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Private recognition</p>
              <p className="text-muted text-xs">
                Only you and the recipient(s) will see it.
              </p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {selected.length > 0 && (
          <Badge variant="secondary">
            {selected.length} selected
          </Badge>
        )}
        <Button type="submit" size="lg" disabled={!canSubmit}>
          <Sparkles className="size-4" />
          {pending ? "Posting…" : "Post recognition"}
        </Button>
      </div>
    </form>
  );
}
