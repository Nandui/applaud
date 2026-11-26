"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { sendChatTest } from "./google-chat";

export async function sendAdminChatTest(): Promise<string> {
  const admin = await requireAdmin();
  return sendChatTest(admin.name);
}
