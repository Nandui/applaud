"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { updateCosmeticPrices, type ActionResult } from "@/lib/economy-actions";
import { COSMETICS, KIND_LABELS, RARITY, type CosmeticKind, type CosmeticPrices } from "@/lib/cosmetics";
import { centsToEuros, pointsToCents } from "@/lib/economy";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const KINDS: CosmeticKind[] = ["frame", "banner", "theme"];

/**
 * Profile Store prices. These items cost the company nothing; the euro column
 * is only the points' face value, to compare with what a shout-out is worth.
 */
export function StorePrices({
  prices,
  pointsPerEuro,
  typicalShoutout,
}: {
  prices: CosmeticPrices;
  pointsPerEuro: number;
  /** A typical shout-out, for "one shout-out buys N items". */
  typicalShoutout: number;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    updateCosmeticPrices,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved.");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);

  const priced = COSMETICS.filter((c) => c.price > 0);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(priced.map((c) => [c.id, String(prices[c.id] ?? c.price)])),
  );
  const price = (id: string) => Math.max(0, Math.floor(Number(values[id])) || 0);
  const collection = priced.reduce((sum, c) => sum + price(c.id), 0);
  const cheapest = Math.min(...priced.map((c) => price(c.id)));
  const euros = (points: number) => centsToEuros(pointsToCents(points, pointsPerEuro));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Store prices</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted mb-4 text-sm">
          Frames, banners and themes cost the company nothing, so keep them cheap: the point is
          that people spend, not save. Every item together costs{" "}
          <b className="text-foreground" data-numeric>
            {formatNumber(collection)} pts
          </b>{" "}
          ({euros(collection)} face value). A {formatNumber(typicalShoutout)}-point shout-out buys
          the cheapest item{" "}
          <span data-numeric>{cheapest > 0 ? formatNumber(Math.floor(typicalShoutout / cheapest)) : "∞"}</span>{" "}
          times over. Starter items stay free.
        </p>
        <form action={formAction} className="space-y-6">
          {KINDS.map((kind) => (
            <div key={kind}>
              <h3 className="mb-2 text-sm font-semibold">{KIND_LABELS[kind].many}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="text-muted text-left text-xs">
                      <th className="py-1.5 font-medium">Item</th>
                      <th className="py-1.5 font-medium">Rarity</th>
                      <th className="w-28 py-1.5 font-medium">Points</th>
                      <th className="py-1.5 text-right font-medium">Face value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COSMETICS.filter((c) => c.kind === kind).map((c) => (
                      <tr key={c.id} className="border-border border-t">
                        <td className="py-1.5">{c.name}</td>
                        <td className="py-1.5">
                          <span style={{ color: RARITY[c.rarity].color }} className="text-xs font-semibold">
                            {RARITY[c.rarity].label}
                          </span>
                        </td>
                        <td className="py-1.5">
                          {c.price === 0 ? (
                            <span className="text-muted">Free starter</span>
                          ) : (
                            <Input
                              name={`price:${c.id}`}
                              aria-label={`${c.name} price in points`}
                              inputMode="numeric"
                              value={values[c.id]}
                              onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
                              className={cn("h-8 w-24 font-mono", price(c.id) !== c.price && "border-primary")}
                            />
                          )}
                        </td>
                        <td data-numeric className="text-muted py-1.5 text-right">
                          {c.price === 0 ? "€0" : euros(price(c.id))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <Link href="/shop" className="text-primary text-sm font-medium">
              View the Store
            </Link>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save Store prices"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
