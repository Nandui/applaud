import { NextResponse } from "next/server";
import { runMilestones } from "@/lib/milestones/run";

export const dynamic = "force-dynamic";

/**
 * Daily milestone cron. Protect with `Authorization: Bearer <CRON_SECRET>`.
 * Idempotent (Celebration unique constraint), so re-runs are safe. Vercel Cron
 * sends this header automatically when CRON_SECRET is set; a systemd timer on a
 * VPS can curl the same endpoint with the header.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runMilestones();
  return NextResponse.json({ ok: true, ...result });
}
