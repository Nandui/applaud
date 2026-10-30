import { NextResponse } from "next/server";
import { syncAwardVotes } from "@/lib/votes/run";

export const dynamic = "force-dynamic";

/**
 * Daily award vote cron: closes votes whose time is up and opens votes that
 * are due. The feed and Awards pages run the same sync after each response,
 * so this is the backstop for quiet days. Same `Authorization: Bearer
 * <CRON_SECRET>` check as the milestones cron; re-runs are safe.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAwardVotes();
  return NextResponse.json({ ok: true, ...result });
}
