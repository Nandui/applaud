"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import {
  getFeedCards,
  refreshFeedCardsByIds,
  type FeedCard,
  type FeedPage,
} from "@/lib/recognition/queries";

const cursorSchema = z.string().min(1).max(64);
const idsSchema = z.array(z.string().min(1).max(64)).max(1000);

/** The next page of the home feed, for infinite scroll. */
export async function loadMoreFeed(cursor: string): Promise<FeedPage> {
  const me = await requireUser();
  const parsed = cursorSchema.safeParse(cursor);
  if (!parsed.success) return { cards: [], nextCursor: null };
  return getFeedCards(me.id, { cursor: parsed.data });
}

/** Up-to-date copies of cards already loaded further down the feed. */
export async function refreshFeedCards(ids: string[]): Promise<FeedCard[]> {
  const me = await requireUser();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return [];
  return refreshFeedCardsByIds(me.id, parsed.data);
}
