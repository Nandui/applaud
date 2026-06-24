/**
 * Reward fulfilment adapter seam (build-spec §10).
 *
 * v1 ships only ManualAdapter (the admin marks redemptions fulfilled in the
 * queue). A future GiftCardAdapter (type "giftcard", fulfilment "auto") slots
 * behind the same Redemption flow with zero schema change — implement this
 * interface and route to it from getFulfilmentAdapter().
 */
export type FulfilmentResult =
  | { ok: true; reference?: string }
  | { ok: false; error: string };

export type FulfilableRedemption = {
  id: string;
  rewardId: string;
  userId: string;
  pointsCost: number;
};

export interface RewardFulfilmentAdapter {
  readonly kind: string;
  fulfil(redemption: FulfilableRedemption): Promise<FulfilmentResult>;
}

/** Manual fulfilment: nothing external happens; the admin completes it. */
export class ManualAdapter implements RewardFulfilmentAdapter {
  readonly kind = "manual";
  async fulfil(): Promise<FulfilmentResult> {
    return { ok: true };
  }
}

/** Selects the adapter for a reward. v1 always returns ManualAdapter. */
export function getFulfilmentAdapter(_reward: {
  type: string;
  fulfilment: string;
}): RewardFulfilmentAdapter {
  // Future: if (_reward.type === "giftcard") return new GiftCardAdapter();
  return new ManualAdapter();
}
