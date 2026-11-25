"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendAdminTestEmail } from "@/lib/email/test-action";

export function TestEmailForm({ email, recognitionId = null }: { email: string; recognitionId?: string | null }) {
  const [message, action, pending] = useActionState(sendAdminTestEmail.bind(null, recognitionId), "");
  const label = recognitionId ? "Send team announcement to me" : "Send test email to me";
  return (
    <form action={action} className="space-y-2">
      <p className="text-muted text-sm">Test recipient: {email}</p>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : label}</Button>
      <p role="status" className="text-sm">{pending ? "" : message}</p>
    </form>
  );
}
