import { NextResponse } from "next/server";
import { runYearEndExpiry } from "@/lib/wallet-expiry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Year-end wallet expiry, scheduled for just after midnight on 1 January
 * (Irish time is UTC in winter). Protect with `Authorization: Bearer
 * <CRON_SECRET>`. Idempotent: the daily milestones cron runs it too, as a
 * catch-up, and re-runs do nothing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runYearEndExpiry();
  return NextResponse.json({ ok: true, ...result });
}
